package orders

import (
	"time"

	"gorm.io/gorm"

	"gin-auth/internal/auth"
	"gin-auth/internal/product"
)

type Order struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"not null;index"`
	User      auth.User `json:"user" gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	CreatedAt time.Time `json:"created_at"`

	GrandTotal int           `json:"grand_total" gorm:"column:total;not null;default:0"`
	Details    []OrderDetail `json:"order_details" gorm:"foreignKey:OrderID"`
}

type OrderDetail struct {
	ID        uint            `json:"id" gorm:"primaryKey"`
	OrderID   uint            `json:"order_id" gorm:"not null;index"`
	Order     *Order          `json:"-" gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	ProductID uint            `json:"product_id" gorm:"not null;index"`
	Product   product.Product `json:"product" gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Subtotal  int             `json:"subtotal" gorm:"-"`
	Qty       int             `json:"qty" gorm:"not null;default:0"`
	Price     int             `json:"price" gorm:"not null;default:0"`
	TaxAmount int             `json:"tax_amount" gorm:"not null;default:0"`
}

// Hitung dari snapshot harga, termasuk untuk order lama tanpa migrasi kolom baru.
func (d *OrderDetail) AfterFind(tx *gorm.DB) error {
	subtotal, err := orderTotal(d.Price, d.Qty)
	d.Subtotal = subtotal
	return err
}
