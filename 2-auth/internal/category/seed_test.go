package category

import "testing"

func TestDefaultCategories(t *testing.T) {
	want := []string{"Elektronik", "Fashion", "Makanan", "Olahraga", "Rumah Tangga"}
	seen := map[string]bool{}

	for _, category := range DefaultCategories {
		seen[category.Name] = true
	}

	for _, name := range want {
		if !seen[name] {
			t.Fatalf("kategori %q tidak ada di data seeder default", name)
		}
	}
}
