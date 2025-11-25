package store

import (
	"context"
	"database/sql"
	"time"
)

// User represents a row in the users table
type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	OIDCID    string    `json:"oidc_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserRepository handles database interactions for users
type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create inserts a new user into the database
func (r *UserRepository) Create(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (email, oidc_id, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	// Use current time
	now := time.Now()

	return r.db.QueryRowContext(
		ctx,
		query,
		user.Email,
		user.OIDCID,
		user.Role,
		now,
		now,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

// GetByOIDCID finds a user by their Auth0 ID
func (r *UserRepository) GetByOIDCID(ctx context.Context, oidcID string) (*User, error) {
	query := `SELECT id, email, oidc_id, role, created_at, updated_at FROM users WHERE oidc_id = $1`

	var user User
	err := r.db.QueryRowContext(ctx, query, oidcID).Scan(
		&user.ID,
		&user.Email,
		&user.OIDCID,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) UpdateRole(ctx context.Context, userID int64, role string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2", role, userID)
	return err
}

func (r *UserRepository) ListAll(ctx context.Context) ([]*User, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT id, email, role, created_at FROM users ORDER BY id ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		var u User
		// We don't need OIDCID here
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id int64) (*User, error) {
	query := `SELECT id, email, oidc_id, role, created_at, updated_at FROM users WHERE id = $1`
	var user User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.OIDCID, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}
