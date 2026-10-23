package product

import (
	"net/http"
	"strings"

	"gin-auth/internal/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Create(c *gin.Context) {
	var input struct {
		Name  string `json:"name" binding:"required,max=100"`
		Stock int    `json:"stock" binding:"required,gte=0"`
		Price int    `json:"price" binding:"required,gte=0"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama product wajib diisi, maksimal 100 karakter"})
		return
	}

	user := c.MustGet("user").(auth.User)

	item, err := h.service.Create(
		c.Request.Context(),
		input.Name,
		input.Stock,
		input.Price,
		user,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan product"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *Handler) List(c *gin.Context) {
	user := c.MustGet("user").(auth.User)
	items, err := h.service.List(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca product"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}
