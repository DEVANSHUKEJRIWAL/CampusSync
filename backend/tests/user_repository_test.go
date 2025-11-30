// tests/user_repository_test.go
package tests

import (
	"context"
	"testing"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

func TestUserRepository_CRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	ctx := context.Background()
	repo := store.NewUserRepository(db)

	// CREATE
	u := &store.User{
		Email:  "testuser@example.com",
		OIDCID: "auth0|testuser",
		Role:   "Member",
	}

	if err := repo.Create(ctx, u); err != nil {
		t.Fatalf("Create(): %v", err)
	}
	if u.ID == 0 {
		t.Fatalf("Create() should assign ID")
	}

	// GET BY OIDC
	u2, err := repo.GetByOIDCID(ctx, u.OIDCID)
	if err != nil {
		t.Fatalf("GetByOIDCID(): %v", err)
	}
	if u2.Email != u.Email {
		t.Fatalf("GetByOIDCID returned wrong user")
	}

	// UPDATE ROLE
	if err := repo.UpdateRole(ctx, u.ID, "Organizer"); err != nil {
		t.Fatalf("UpdateRole(): %v", err)
	}

	updated, _ := repo.GetByID(ctx, u.ID)
	if updated.Role != "Organizer" {
		t.Fatalf("Role should be updated")
	}

	// TOGGLE ACTIVE
	if err := repo.ToggleActive(ctx, u.ID, false); err != nil {
		t.Fatalf("ToggleActive(): %v", err)
	}

	users, err := repo.ListAll(ctx)
	if err != nil {
		t.Fatalf("ListAll(): %v", err)
	}
	if len(users) != 1 || users[0].IsActive != false {
		t.Fatalf("ToggleActive did not persist")
	}
}
