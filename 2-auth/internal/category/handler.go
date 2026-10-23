package category

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

//tambah category

// Create membuat kategori baru.
func (h *Handler) Create(c *gin.Context) {
	var input struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Nama kategori wajib diisi",
		})
		return
	}

	// Ubah satu input menjadi slice agar sesuai dengan service saat ini.
	items := []ItemInput{
		{
			Name: input.Name,
		},
	}

	category, err := h.service.Create(
		c.Request.Context(),
		items,
	)

	if errors.Is(err, ErrInvalidCategory) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if errors.Is(err, ErrDuplikatCategory) {
		c.JSON(http.StatusConflict, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal membuat kategori",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Kategori berhasil dibuat",
		"data":    category,
	})
}

// List mengambil daftar kategori.
func (h *Handler) ListCategory(c *gin.Context) {
	idParam := c.Query("id")
	id := 0

	if idParam != "" {
		parsedID, err := strconv.Atoi(idParam)
		if err != nil || parsedID < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "ID kategori tidak valid",
			})
			return
		}
		id = parsedID
	}

	categories, err := h.service.ListCategory(
		c.Request.Context(),
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal membaca kategori",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": categories,
	})
}

// GetByID mengambil satu kategori berdasarkan ID.
func (h *Handler) GetByID(c *gin.Context) {
	var input struct {
		ID int `uri:"id" binding:"required,gt=0"`
	}

	if err := c.ShouldBindUri(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID kategori tidak valid",
		})
		return
	}

	category, err := h.service.GetCategoryByID(
		c.Request.Context(),
		int(input.ID),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal membaca kategori",
		})
		return
	}

	if category == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Kategori tidak ditemukan",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": category,
	})
}

// Delete menghapus kategori berdasarkan ID.
func (h *Handler) Delete(c *gin.Context) {
	var input struct {
		ID uint `uri:"id" binding:"required,gt=0"`
	}

	if err := c.ShouldBindUri(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID kategori tidak valid",
		})
		return
	}

	err := h.service.Delete(
		c.Request.Context(),
		input.ID,
	)

	if errors.Is(err, ErrInvalidCategory) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if errors.Is(err, ErrCategoryNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal menghapus kategori",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Kategori berhasil dihapus",
	})
}
