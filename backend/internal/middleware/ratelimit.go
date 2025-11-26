package middleware

import (
	"net/http"
	"sync"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

// RateLimiter is a simple in-memory limiter
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]time.Time
	limit    time.Duration
}

func NewRateLimiter(limit time.Duration) *RateLimiter {
	return &RateLimiter{
		visitors: make(map[string]time.Time),
		limit:    limit,
	}
}

// LimitMiddleware checks if the user has made a request recently
func (l *RateLimiter) LimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get User ID from token (assumes Auth middleware ran first)
		claims, ok := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		userID := claims.RegisteredClaims.Subject

		l.mu.Lock()
		lastSeen, exists := l.visitors[userID]

		if exists && time.Since(lastSeen) < l.limit {
			l.mu.Unlock()
			// 429 Too Many Requests
			http.Error(w, "Rate limit exceeded. Please wait.", http.StatusTooManyRequests)
			return
		}

		l.visitors[userID] = time.Now()
		l.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}
