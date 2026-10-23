package category

import (
	"time"

	"gorm.io/gorm"
)

type Category struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null;size:100"`
	CreatedAt time.Time `json:"created_at"`
}

var DefaultCategories = []Category{
	{Name: "Elektronik"},
	{Name: "Fashion"},
	{Name: "Makanan"},
	{Name: "Olahraga"},
	{Name: "Rumah Tangga"},
}

func SeedCategories(db *gorm.DB) {
	for _, category := range DefaultCategories {
		db.FirstOrCreate(&category, Category{Name: category.Name})
	}
}
