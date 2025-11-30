package tests

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/middleware"
)

func TestRateLimiter_BlocksRapidRequests(t *testing.T) {
	rl := middleware.NewRateLimiter(1 * time.Minute)

	var count int32
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&count, 1)
		w.WriteHeader(http.StatusOK)
	})

	wrapped := rl.LimitMiddleware(handler)

	// First request from same user should pass
	req1 := httptest.NewRequest(http.MethodGet, "/registrations", nil)
	req1 = injectClaims(req1, "auth0|ratelimit-user")
	w1 := httptest.NewRecorder()
	wrapped.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("expected first request 200, got %d", w1.Code)
	}
	if got := atomic.LoadInt32(&count); got != 1 {
		t.Fatalf("expected handler to be called once, got %d", got)
	}

	// Second immediate request should be blocked with 429
	req2 := httptest.NewRequest(http.MethodGet, "/registrations", nil)
	req2 = injectClaims(req2, "auth0|ratelimit-user")
	w2 := httptest.NewRecorder()
	wrapped.ServeHTTP(w2, req2)

	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w2.Code)
	}
	if got := atomic.LoadInt32(&count); got != 1 {
		t.Fatalf("handler should NOT be called again under rate limit, got count=%d", got)
	}
}
