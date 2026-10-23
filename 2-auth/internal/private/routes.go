package private

import (
	"net/http"

	"gin-auth/internal/middleware"
	"gin-auth/internal/product"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, requireAuth gin.HandlerFunc, productHandler *product.Handler) {
	group := r.Group("/api/private")
	group.Use(requireAuth)
	product.RegisterRoutes(group, productHandler)
	group.GET("/profile", middleware.MockEndpoint("private.profile"), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": c.MustGet("user")})
	})
}
