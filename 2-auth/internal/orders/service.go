package orders

import (
	"cmp"
	"context"
	"errors"
	"math"
	"slices"

	"gin-auth/internal/auth"
)

var (
	ErrInvalidOrder      = errors.New("items wajib diisi; product_id dan quantity harus lebih dari 0 dan product_id tidak boleh duplikat")
	ErrInsufficientStock = errors.New("stok product tidak cukup")
)

type Service struct{ repo *Repository }

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

type ItemInput struct {
	ProductID uint `json:"product_id" binding:"required,gt=0"`
	Quantity  int  `json:"quantity" binding:"required,gte=1"`
}

func (s *Service) Create(ctx context.Context, items []ItemInput, user auth.User) (Order, error) {
	if len(items) == 0 || user.ID == 0 {
		return Order{}, ErrInvalidOrder
	}
	items = slices.Clone(items)
	// Urutan kunci konsisten mencegah deadlock antar order banyak produk.
	slices.SortFunc(items, func(a, b ItemInput) int { return cmp.Compare(a.ProductID, b.ProductID) })
	for i, item := range items {
		if item.ProductID == 0 || item.Quantity <= 0 || (i > 0 && items[i-1].ProductID == item.ProductID) {
			return Order{}, ErrInvalidOrder
		}
	}
	return s.repo.Create(ctx, items, user.ID)
}

func orderTotal(price, quantity int) (int, error) {
	if price < 0 || quantity <= 0 || (price > 0 && quantity > math.MaxInt/price) {
		return 0, ErrInvalidOrder
	}
	return (price * quantity) + TaxAmount(price), nil
}

func TaxAmount(price int) int {
	if price < 0 {
		return 0
	}

	// Pajak 11%, pembulatan ke bawah.
	tax := (price / 100) * 11
	remainder := (price % 100) * 11 / 100

	return tax + remainder
}

func (s *Service) List(ctx context.Context, userID uint) ([]Order, error) {
	return s.repo.List(ctx, userID)
}
func (s *Service) GetByID(ctx context.Context, id, userID uint) (*Order, error) {
	return s.repo.GetByID(ctx, id, userID)
}
