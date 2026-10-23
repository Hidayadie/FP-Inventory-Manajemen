package category

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrInvalidCategory  = errors.New("nama category wajib diisi")
	ErrDuplikatCategory = errors.New("Category sudah ada")
	ErrCategoryNotFound = errors.New("Kategori tidak ditemukan")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

type ItemInput struct {
	ID   uint   `json:"id"`
	Name string `json:"name" binding:"required"`
}

func (s *Service) Create(
	ctx context.Context,
	items []ItemInput,
) (Category, error) {
	if len(items) == 0 {
		return Category{}, ErrInvalidCategory
	}

	// Validasi nama dan cek duplikat setiap kategori.
	for i := range items {
		items[i].Name = strings.TrimSpace(items[i].Name)

		if items[i].Name == "" {
			return Category{}, ErrInvalidCategory
		}

		exists, err := s.repo.ExistsByName(ctx, items[i].Name)
		if err != nil {
			return Category{}, err
		}

		if exists {
			return Category{}, ErrDuplikatCategory
		}
	}

	return s.repo.Create(ctx, items)
}

func (s *Service) ListCategory(ctx context.Context, ID int) ([]Category, error) {
	return s.repo.ListCategory(ctx, ID)
}
func (s *Service) GetCategoryByID(ctx context.Context, id int) (*Category, error) {
	return s.repo.GetCategoryByID(ctx, id)
}

// Delete menghapus kategori berdasarkan ID.
func (s *Service) Delete(
	ctx context.Context,
	id uint,
) error {
	if id == 0 {
		return ErrInvalidCategory
	}

	deleted, err := s.repo.DeleteCategoryByID(ctx, int(id))
	if err != nil {
		return err
	}

	if !deleted {
		return ErrCategoryNotFound
	}

	return nil
}
