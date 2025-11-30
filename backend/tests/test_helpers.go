// tests/test_helpers.go
package tests

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"

	_ "github.com/lib/pq"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// fmt.Println("SETUP: beginning test DB setup")

	dsn := os.Getenv("TEST_DB_DSN")
	// fmt.Println("SETUP: DSN =", dsn)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("SETUP: cannot open DB: %v", err)
	}

	if err := db.Ping(); err != nil {
		t.Fatalf("SETUP: cannot ping DB: %v", err)
	}
	// fmt.Println("SETUP: DB Ping OK")

	if err := truncateAll(t, db); err != nil {
		t.Fatalf("SETUP: truncateAll failed: %v", err)
	}
	// fmt.Println("SETUP: truncateAll completed")

	if err := runMigrations(t, db); err != nil {
		t.Fatalf("SETUP: runMigrations failed: %v", err)
	}
	// fmt.Println("SETUP: runMigrations completed")

	return db
}

func runMigrations(t *testing.T, db *sql.DB) error {
	t.Helper()

	// Determine absolute path to backend/db/migrations
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("runtime.Caller failed")
	}

	// filename is .../backend/tests/test_helpers.go
	backendDir := filepath.Dir(filepath.Dir(filename))
	// now backendDir = .../backend

	migrationsDir := filepath.Join(backendDir, "db", "migrations")

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations dir (%s): %w", migrationsDir, err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, e := range entries {
		if e.IsDir() {
			continue
		}

		path := filepath.Join(migrationsDir, e.Name())
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		if _, err := db.Exec(string(sqlBytes)); err != nil {
			return fmt.Errorf("exec %s: %w", path, err)
		}
	}

	return nil
}

func truncateAll(t *testing.T, db *sql.DB) error {
	t.Helper()

	// Drop everything that migrations create (idempotent)
	drops := []string{
		"DROP TABLE IF EXISTS notifications CASCADE",
		"DROP TABLE IF EXISTS event_feedback CASCADE",
		"DROP TABLE IF EXISTS invitations CASCADE",
		"DROP TABLE IF EXISTS waitlist CASCADE",
		"DROP TABLE IF EXISTS registrations CASCADE",
		"DROP TABLE IF EXISTS events CASCADE",
		"DROP TABLE IF EXISTS users CASCADE",

		// Drop custom ENUM types safely
		"DROP TYPE IF EXISTS registration_status CASCADE",
		"DROP TYPE IF EXISTS event_status CASCADE",
		"DROP TYPE IF EXISTS event_visibility CASCADE",
	}

	for _, q := range drops {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("schema reset error for %q: %w", q, err)
		}
	}

	return nil
}
