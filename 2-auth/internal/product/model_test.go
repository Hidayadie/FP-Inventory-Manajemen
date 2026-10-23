package product

import (
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

func TestCategoryRelationSchema(t *testing.T) {
	model, err := schema.Parse(&Product{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatal(err)
	}
	relation := model.Relationships.Relations["Category"]
	if relation == nil || relation.Type != schema.BelongsTo || len(relation.References) != 1 {
		t.Fatalf("relasi Category tidak valid: %+v", relation)
	}
	ref := relation.References[0]
	if ref.ForeignKey.DBName != "category_id" || ref.PrimaryKey.DBName != "id" || relation.FieldSchema.Table != "categories" {
		t.Fatalf("foreign key Category tidak valid: %+v", ref)
	}
	constraint := relation.ParseConstraint()
	if constraint == nil || constraint.OnUpdate != "CASCADE" || constraint.OnDelete != "RESTRICT" {
		t.Fatalf("constraint Category tidak valid: %+v", constraint)
	}
}
