package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"gin-auth/internal/auth"
	"gin-auth/internal/category"
	"gin-auth/internal/database"
	"gin-auth/internal/middleware"
	"gin-auth/internal/orders"
	"gin-auth/internal/product"
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
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
		c.Next()
	})
	r.GET("/health", middleware.MockEndpoint("health"), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})
	repo := auth.NewRepository(db)
	service := auth.NewService(repo, secret)
	handler := auth.NewHandler(service)
	auth.RegisterRoutes(r, handler)
	public.RegisterRoutes(r)

	//productRepo := product.NewRepository(db)
	//productService := product.NewService(productRepo)
	//productHandler := product.NewHandler(productService)

	//private.RegisterRoutes(r, handler.RequireAuth(), productHandler)
	//orderHandler := orders.NewHandler(orders.NewService(orders.NewRepository(db)))
	//orders.RegisterRoutes(r.Group("/api/private", handler.RequireAuth()), orderHandler)
	return r
}

func run() error {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
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
		&product.Product{},
		&category.Category{},
		&orders.Order{},
		&orders.OrderDetail{},
	); err != nil {
		return fmt.Errorf("migrasi tabel users/products gagal: %w", err)
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
