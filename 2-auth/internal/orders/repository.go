package orders

import (
	"context"
	"errors"
	"gin-auth/internal/product"
	"math"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(
	ctx context.Context,
	items []ItemInput,
	userID uint,
) (Order, error) {
	var order Order

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order = Order{UserID: userID}

		for _, input := range items {
			if input.Quantity <= 0 {
				return ErrInvalidOrder
			}

			var item product.Product

			// Mengunci baris produk selama transaksi berlangsung.
			if err := tx.Clauses(
				clause.Locking{Strength: "UPDATE"},
			).First(&item, input.ProductID).Error; err != nil {
				return err
			}

			if item.Stock < input.Quantity {
				return ErrInsufficientStock
			}

			subtotal, err := orderTotal(item.Price, input.Quantity)
			if err != nil {
				return err
			}

			taxAmount := TaxAmount(item.Price)

			// Total per item = subtotal + pajak.
			if subtotal > math.MaxInt-taxAmount {
				return ErrInvalidOrder
			}

			itemTotal := subtotal + taxAmount

			// Memastikan grand total tidak overflow.
			if order.GrandTotal > math.MaxInt-itemTotal {
				return ErrInvalidOrder
			}

			order.GrandTotal += itemTotal

			order.Details = append(order.Details, OrderDetail{
				ProductID: item.ID,
				Qty:       input.Quantity,
				Price:     item.Price,
				TaxAmount: taxAmount,
			})

			if err := tx.Model(&item).Update(
				"stock",
				gorm.Expr("stock - ?", input.Quantity),
			).Error; err != nil {
				return err
			}
		}

		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		return tx.Preload("User").
			Preload("Details.Product").
			First(&order, order.ID).Error
	})

	if err != nil {
		return Order{}, err
	}

	return order, nil
}

func (r *Repository) List(ctx context.Context, userID uint) ([]Order, error) {
	orders := []Order{}
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Preload("User").Preload("Details.Product").Order("id DESC").Find(&orders).Error
	return orders, err
}

func (r *Repository) GetByID(ctx context.Context, id, userID uint) (*Order, error) {
	var order Order
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Preload("User").Preload("Details.Product").First(&order, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}
