package auth

import "time"

type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null"`
	Email     string    `json:"email" gorm:"not null;uniqueIndex"`
	Password  string    `json:"-" gorm:"not null"`
	Role      string    `json:"role" gorm:"not null"`
	CreatedAt time.Time `json:"create_at"`
	UpdateAt  time.Time `json:"update_at"`
}

type credentials struct {
	Email    string `json:"email" binding:"required,email,max=254"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}
