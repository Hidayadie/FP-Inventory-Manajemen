package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"gin-auth/internal/asset"
	"gin-auth/internal/auth"
	"gin-auth/internal/category"
	"gin-auth/internal/database"
	"gin-auth/internal/location"
	"gin-auth/internal/middleware"
	"gin-auth/internal/public"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func setupEngine(db *gorm.DB, secret []byte) *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:8081"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(
			c.Writer,
			c.Request.Body,
			1<<20,
		)
		c.Next()
	})

	r.GET("/health", middleware.MockEndpoint("health"), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{"status": "ok"},
		})
	})

	// Auth
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo, secret)
	authHandler := auth.NewHandler(authService)

	auth.RegisterRoutes(r, authHandler)

	// Public routes
	public.RegisterRoutes(r)

	// Category
	categoryRepo := category.NewRepository(db)
	categoryService := category.NewService(categoryRepo)
	categoryHandler := category.NewHandler(categoryService)

	// Endpoint category dengan autentikasi
	categoryRoutes := r.Group("/api/categories")
	categoryRoutes.Use(authHandler.AuthReq())
	{
		categoryRoutes.POST("", categoryHandler.Create)
		categoryRoutes.GET("", categoryHandler.ListCategory)
		categoryRoutes.GET("/:id", categoryHandler.GetByID)
		categoryRoutes.DELETE("/:id", categoryHandler.Delete)
		categoryRoutes.PUT("/:id", categoryHandler.Update)
	}

	// Category
	locationRepo := location.NewRepository(db)
	locationService := location.NewService(locationRepo)
	locationHandler := location.NewHandler(locationService)

	// Endpoint location dengan autentikasi
	locationRoutes := r.Group("/api/location")
	locationRoutes.Use(authHandler.AuthReq())
	{
		locationRoutes.POST("", locationHandler.Create)
		locationRoutes.GET("", locationHandler.GetAllLoc)
		locationRoutes.GET("/:id", locationHandler.GetLocByID)
		locationRoutes.DELETE("/:id", locationHandler.Delete)
		locationRoutes.PUT("/:id", locationHandler.Update)
	}

	// asset
	assetRepo := asset.NewRepository(db)
	assetService := asset.NewService(
		assetRepo,
		categoryRepo,
		locationRepo,
	)
	assetHandler := asset.NewHandler(assetService)
	// Endpoint Asset dengan autentikasi
	assetRoutes := r.Group("/api/assets")
	assetRoutes.Use(authHandler.AuthReq())
	{
		assetRoutes.POST("", assetHandler.Create)
		assetRoutes.GET("", assetHandler.List)
		assetRoutes.GET("/:id", assetHandler.GetByID)
		assetRoutes.DELETE("/:id", assetHandler.Delete)
		assetRoutes.PUT("/:id", assetHandler.Update)
	}
	return r
}

func run() error {
	if err := godotenv.Load(); err != nil &&
		!errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("load .env: %w", err)
	}

	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) < 32 {
		return fmt.Errorf("JWT_SECRET wajib diisi minimal 32 byte")
	}

	db, err := database.Open(os.Getenv("DATABASE_URL"))
	if err != nil {
		return fmt.Errorf("buka database: %w", err)
	}

	conn, err := db.DB()
	if err != nil {
		return err
	}
	defer conn.Close()

	if err := db.AutoMigrate(
		&auth.User{},
		&location.Location{},
		&category.Category{},
		&asset.Asset{},
	); err != nil {
		return fmt.Errorf("migrasi tabel gagal: %w", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           setupEngine(db, secret),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("Server berjalan di http://localhost:%s", port)
	return server.ListenAndServe()
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
