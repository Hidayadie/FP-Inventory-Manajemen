package product

import (
	"time"

	"gin-auth/internal/auth"
	"gin-auth/internal/category"
)

type Product struct {
	ID     uint      `json:"id" gorm:"primaryKey"`
	Name   string    `json:"name" gorm:"not null;size:100"`
	UserID uint      `json:"user_id" gorm:"not null;index"`
	User   auth.User `json:"user" gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	// ponytail: kategori opsional; wajibkan setelah API menerima kategori dan data lama dilengkapi.
	CategoryID *uint             `json:"category_id" gorm:"index"`
	Category   category.Category `json:"category" gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	CreatedAt  time.Time         `json:"created_at"`

	Stock int `json:"stock" gorm:"not null;default:0"`
	Price int `json:"price" gorm:"not null;default:0"`
}
