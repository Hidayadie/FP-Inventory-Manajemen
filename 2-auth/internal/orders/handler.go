package orders

import (
	"errors"
	"gin-auth/internal/auth"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) Create(c *gin.Context) {
	var input struct {
		Items []ItemInput `json:"items" binding:"required,min=1,dive"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "items wajib diisi; setiap item wajib memiliki product_id lebih dari 0 dan quantity minimal 1"})
		return
	}

	user := c.MustGet("user").(auth.User)

	order, err := h.service.Create(c.Request.Context(), input.Items, user)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product tidak ditemukan"})
		return
	}
	if errors.Is(err, ErrInvalidOrder) || errors.Is(err, ErrInsufficientStock) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat order"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": order})
}

func (h *Handler) List(c *gin.Context) {
	user := c.MustGet("user").(auth.User)

	orders, err := h.service.List(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca order"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

func (h *Handler) GetByID(c *gin.Context) {
	var input struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID order wajib diisi"})
		return
	}

	user := c.MustGet("user").(auth.User)

	order, err := h.service.GetByID(c.Request.Context(), input.ID, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca order"})
		return
	}
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}
