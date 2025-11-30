package tests

import (
	"os"
	"testing"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
)

// Covers: NewPostgresDB success path (requires TEST_DB_DSN + running Postgres)
func TestNewPostgresDB_Success(t *testing.T) {
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("TEST_DB_DSN not set; skipping DB connection test")
	}

	db, err := store.NewPostgresDB(dsn)
	if err != nil {
		t.Fatalf("NewPostgresDB() error = %v", err)
	}
	defer db.Close()
}

// Covers: NewPostgresDB failure path
func TestNewPostgresDB_Failure(t *testing.T) {
	// Intentionally bad DSN / port
	_, err := store.NewPostgresDB("postgres://bad:bad@127.0.0.1:1/bad?sslmode=disable")
	if err == nil {
		t.Fatalf("expected error for invalid DSN, got nil")
	}
}
