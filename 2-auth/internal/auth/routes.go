package auth

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes mendaftarkan semua route autentikasi dan dashboard.
func RegisterRoutes(r *gin.Engine, h *Handler) {
	// Endpoint publik: tidak membutuhkan login.
	apiAuth := r.Group("/api/auth")
	{
		apiAuth.POST("/register", h.Register)
		apiAuth.POST("/login", h.Login)
	}

	// Endpoint logout tidak wajib melewati autentikasi.
	// Tujuannya agar cookie tetap bisa dihapus ketika token kedaluwarsa.
	apiAuth.POST("/logout", h.Logout)

	// Endpoint privat: membutuhkan autentikasi.
	r.GET("/api/me", h.AuthReq(), h.Me)

	// Dashboard: membutuhkan autentikasi dan role yang sesuai.
	registerDashboardRoutes(r, h)
}

// registerDashboardRoutes mendaftarkan halaman dashboard.
func registerDashboardRoutes(r *gin.Engine, h *Handler) {
	pages := r.Group("/")
	pages.Use(h.AuthReq())

	// Mengarahkan pengguna ke dashboard sesuai role dari database.
	pages.GET("/dashboard", func(c *gin.Context) {
		user, ok := currentUser(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Data pengguna tidak tersedia",
			})
			return
		}

		switch strings.ToLower(strings.TrimSpace(user.Role)) {
		case "admin":
			serveDashboard(c, "admin")
		case "user":
			serveDashboard(c, "user")
		case "teknisi":
			serveDashboard(c, "teknisi")
		default:
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Role pengguna tidak memiliki akses dashboard",
			})
		}
	})

	// Dashboard khusus admin.
	pages.GET("/admin/dashboard", RequireRole("admin"), func(c *gin.Context) {
		serveDashboard(c, "admin")
	})

	// Dashboard khusus user.
	pages.GET("/user/dashboard", RequireRole("user"), func(c *gin.Context) {
		serveDashboard(c, "user")
	})

	// Dashboard khusus teknisi.
	pages.GET("/teknisi/dashboard", RequireRole("teknisi"), func(c *gin.Context) {
		serveDashboard(c, "teknisi")
	})
}

// currentUser mengambil user yang disimpan middleware AuthReq.
// Service Authenticate pada kode kamu mengembalikan User, bukan *User.
func currentUser(c *gin.Context) (User, bool) {
	value, exists := c.Get("user")
	if !exists {
		return User{}, false
	}

	user, ok := value.(User)
	if !ok {
		return User{}, false
	}

	return user, true
}

// serveDashboard menyajikan file dashboard berdasarkan role.
func serveDashboard(c *gin.Context, role string) {
	// Sesuaikan kandidat dengan struktur folder proyekmu.
	candidates := []string{
		"client/" + role + "/dashboard.html",
		"../1-frontend/client/" + role + "/dashboard.html",
		"1-frontend/client/" + role + "/dashboard.html",
		"/login.html",
	}

	for _, path := range candidates {
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}

		c.File(path)
		return
	}

	c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
		"error": "File dashboard tidak ditemukan",
		"role":  role,
	})
}
