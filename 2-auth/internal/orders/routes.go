package orders

import "github.com/gin-gonic/gin"

func RegisterRoutes(group *gin.RouterGroup, h *Handler) {
	group.POST("/orders", h.Create)
	group.GET("/orders", h.List)
	group.GET("/orders/:id", h.GetByID)
}
