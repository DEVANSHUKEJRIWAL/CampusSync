package store

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
)

func NewPostgresDB(dsn string) (*sql.DB, error) {
	// 1. Open the connection
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	// 2. Ping the DB to ensure the connection is actually alive
	if err := db.Ping(); err != nil {
		return nil, err
	}

	log.Println("✅ Successfully connected to the database!")
	return db, nil
}
