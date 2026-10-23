package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthReq memeriksa token dari cookie access_token atau header Bearer.
func (h *Handler) AuthReq() gin.HandlerFunc {
	return func(c *gin.Context) {
		unauthorized := func() {
			c.Header("WWW-Authenticate", "Bearer")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Token tidak valid atau kedaluwarsa",
			})
		}

		token, _ := c.Cookie("access_token")

		// Jika Authorization tersedia, gunakan token dari header.
		if header := c.GetHeader("Authorization"); header != "" {
			parts := strings.Fields(header)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				unauthorized()
				return
			}
			token = parts[1]
		}

		if token == "" {
			unauthorized()
			return
		}

		// Authenticate mengembalikan User (value), bukan *User.
		user, err := h.service.Authenticate(c.Request.Context(), token)
		if errors.Is(err, ErrInvalidToken) {
			unauthorized()
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Gagal membaca pengguna",
			})
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

// RequireRole hanya melanjutkan request jika role user diizinkan.
// Fungsi ini harus dipasang setelah AuthReq().
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		value, exists := c.Get("user")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Silakan login terlebih dahulu",
			})
			return
		}

		// Service.Authenticate() mengembalikan User, bukan *User.
		user, ok := value.(User)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Data pengguna tidak valid",
			})
			return
		}

		userRole := strings.ToLower(strings.TrimSpace(user.Role))
		for _, allowedRole := range allowedRoles {
			if userRole == strings.ToLower(strings.TrimSpace(allowedRole)) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "Kamu tidak memiliki izin mengakses halaman ini",
		})
	}
}
