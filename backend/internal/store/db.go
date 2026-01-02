package store

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
)

func NewPostgresDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// 👇 UPDATED MIGRATIONS
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS event_feedback (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL,
            user_id INT NOT NULL,
            rating INT,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
		`ALTER TABLE event_feedback ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'NEUTRAL';`,

		// 1. Comments Table (New)
		`CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL,
            user_id INT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,

		// 2. Photos Table (New)
		`CREATE TABLE IF NOT EXISTS event_photos (
            id SERIAL PRIMARY KEY,
            event_id INT NOT NULL,
            url TEXT NOT NULL,
            uploaded_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
	}

	for _, query := range migrations {
		if _, err := db.Exec(query); err != nil {
			log.Printf("⚠️ Migration warning: %v", err)
		}
	}

	log.Println(" Successfully connected to the database!")
	return db, nil
}
