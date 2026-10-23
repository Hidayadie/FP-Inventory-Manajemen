package product

import (
	"gin-auth/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(group *gin.RouterGroup, h *Handler) {
	group.POST("/products", middleware.MockEndpoint("private.products.create"), h.Create)
	group.GET("/products", middleware.MockEndpoint("private.products.list"), h.List)
}
