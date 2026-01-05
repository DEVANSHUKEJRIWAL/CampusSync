package store

import (
	"context"
	"database/sql"
	"time"
)

type User struct {
	ID             int64      `json:"id"`
	Email          string     `json:"email"`
	OIDCID         string     `json:"oidc_id"`
	Role           string     `json:"role"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	IsActive       bool       `json:"is_active"`
	Points         int        `json:"points"`
	CurrentStreak  int        `json:"current_streak"`
	LastAttendedAt *time.Time `json:"last_attended_at"`
}

type Badge struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	EarnedAt    time.Time `json:"earned_at"`
}

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *User) error {
	query := `
       INSERT INTO users (email, oidc_id, role, created_at, updated_at, is_active, points)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (email) DO UPDATE
       SET updated_at = $5
       RETURNING id, role, created_at, updated_at, is_active, points
    `
	now := time.Now()

	return r.db.QueryRowContext(ctx, query,
		user.Email,
		user.OIDCID,
		user.Role,
		now,
		now,
		user.Points,
	).Scan(
		&user.ID, &user.Role, &user.CreatedAt, &user.UpdatedAt, &user.IsActive, &user.Points,
	)
}

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

func (r *UserRepository) AddBadge(ctx context.Context, userID int64, name, icon string) error {
	query := `
        INSERT INTO user_badges (user_id, badge_name, icon, earned_at)
        VALUES ($1, $2, $3, NOW())
    `

	_, err := r.db.ExecContext(ctx, query, userID, name, icon)
	return err
}

func (r *UserRepository) ListAll(ctx context.Context) ([]*User, error) {
	query := "SELECT id, email, oidc_id, role, created_at, updated_at, is_active FROM users ORDER BY id ASC"

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.OIDCID, &u.Role, &u.CreatedAt, &u.UpdatedAt, &u.IsActive); err != nil {
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

func (r *UserRepository) ToggleActive(ctx context.Context, userID int64, isActive bool) error {
	query := "UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2"
	_, err := r.db.ExecContext(ctx, query, isActive, userID)
	return err
}

func (r *UserRepository) GetLeaderboard(ctx context.Context) ([]*User, error) {
	query := `SELECT id, email, role, points, current_streak FROM users WHERE is_active = true ORDER BY points DESC LIMIT 10`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.Points, &u.CurrentStreak); err != nil {
			return nil, err
		}
		users = append(users, &u)
	}
	return users, nil
}

// GetUserBadges returns badges for a specific user
func (r *UserRepository) GetUserBadges(ctx context.Context, userID int64) ([]*Badge, error) {
	query := `
        SELECT b.name, b.description, b.icon, ub.earned_at
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.user_id = $1
        ORDER BY ub.earned_at DESC
    `
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var badges []*Badge
	for rows.Next() {
		var b Badge
		if err := rows.Scan(&b.Name, &b.Description, &b.Icon, &b.EarnedAt); err != nil {
			return nil, err
		}
		badges = append(badges, &b)
	}
	return badges, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := `
        SELECT id, email, oidc_id, role, created_at, updated_at, is_active, 
               COALESCE(points, 0), COALESCE(current_streak, 0) 
        FROM users 
        WHERE email = $1`

	var u User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID,
		&u.Email,
		&u.OIDCID,
		&u.Role,
		&u.CreatedAt,
		&u.UpdatedAt,
		&u.IsActive,
		&u.Points,
		&u.CurrentStreak,
	)

	if err != nil {
		return nil, err
	}
	return &u, nil
}
