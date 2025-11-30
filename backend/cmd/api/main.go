package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/auth"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/background"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/events"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/middleware"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/notifications"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/registration"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/store"
	"github.com/DEVANSHUKEJRIWAL/CampusSync/internal/users"
)

func main() {
	// 1. Database Connection
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "postgres://postgres:password@127.0.0.1:5432/cems?sslmode=disable"
	}

	db, err := store.NewPostgresDB(dsn)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	updater := background.NewStatusUpdater(db)
	updater.Start()
	log.Println("⏰ Background Status Updater started")

	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)

	notifyService := notifications.NewService()

	regService := &registration.Service{
		DB:            db,
		Notifications: notifyService,
	}

	eventHandler := &events.Handler{
		Repo:          eventRepo,
		UserRepo:      userRepo,
		Notifications: notifyService,
	}
	userHandler := &users.Handler{Repo: userRepo}
	regHandler := &registration.Handler{
		Service:   regService,
		UserRepo:  userRepo,
		EventRepo: eventRepo,
	}
	auth0Domain := os.Getenv("AUTH0_DOMAIN")
	if auth0Domain == "" {
		log.Fatal("AUTH0_DOMAIN environment variable is required")
	}

	auth0Audience := os.Getenv("AUTH0_AUDIENCE")
	if auth0Audience == "" {
		auth0Audience = "http://localhost:8080"
	}

	authMiddleware := auth.EnsureValidToken(auth0Domain, auth0Audience)
	rateLimiter := middleware.NewRateLimiter(2 * time.Second)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "db": "connected"})
	})
	mux.HandleFunc("GET /api/events", eventHandler.HandleListEvents)

	apiMux := http.NewServeMux()

	apiMux.HandleFunc("POST /users/sync", userHandler.HandleSyncUser)
	apiMux.HandleFunc("POST /events", eventHandler.HandleCreateEvent)
	apiMux.HandleFunc("PUT /events", eventHandler.HandleUpdateEvent)
	apiMux.HandleFunc("POST /events/invite", eventHandler.HandleInviteUser)
	apiMux.HandleFunc("POST /events/invite/bulk", eventHandler.HandleBulkInvite)
	apiMux.HandleFunc("GET /events/attendees", eventHandler.HandleListAttendees)
	apiMux.HandleFunc("GET /events/export", eventHandler.HandleExportAttendees)
	apiMux.HandleFunc("POST /events/feedback", eventHandler.HandleAddFeedback)
	apiMux.Handle("POST /registrations", rateLimiter.LimitMiddleware(http.HandlerFunc(regHandler.HandleRegister)))
	apiMux.HandleFunc("DELETE /registrations", regHandler.HandleCancel)
	apiMux.HandleFunc("GET /registrations/me", regHandler.HandleListMyRegistrations)
	apiMux.HandleFunc("GET /admin/users", userHandler.HandleListUsers)
	apiMux.HandleFunc("PATCH /admin/users/role", userHandler.HandleUpdateRole)
	apiMux.HandleFunc("PATCH /admin/users/active", userHandler.HandleToggleActive)
	apiMux.HandleFunc("GET /admin/analytics", eventHandler.HandleGetAnalytics)

	noteHandler := &notifications.Handler{Repo: eventRepo, UserRepo: userRepo}
	apiMux.HandleFunc("GET /notifications", noteHandler.HandleListNotifications)
	apiMux.HandleFunc("POST /notifications/read", noteHandler.HandleMarkRead)

	mux.Handle("/api/", http.StripPrefix("/api", authMiddleware(apiMux)))

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      auth.EnableCORS(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Println("Starting CEMS Backend on port 8080...")
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
