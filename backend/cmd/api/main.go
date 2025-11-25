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

	// Start Background Status Updater
	updater := background.NewStatusUpdater(db)
	updater.Start()
	log.Println("⏰ Background Status Updater started")

	// 2. Initialize Repositories & Handlers
	userRepo := store.NewUserRepository(db)
	eventRepo := store.NewEventRepository(db)

	notifyService := notifications.NewService()

	regService := &registration.Service{
		DB:            db,
		Notifications: notifyService,
	}

	eventHandler := &events.Handler{Repo: eventRepo, UserRepo: userRepo}
	userHandler := &users.Handler{Repo: userRepo}
	regHandler := &registration.Handler{
		Service:   regService,
		UserRepo:  userRepo,
		EventRepo: eventRepo,
	}

	auth0Domain := "YOUR_AUTH0_DOMAIN"
	auth0Audience := "http://localhost:8080"

	authMiddleware := auth.EnsureValidToken(auth0Domain, auth0Audience)

	// 4. Router Setup
	mux := http.NewServeMux()

	// --- PUBLIC ROUTES (No Auth Required) ---
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "db": "connected"})
	})

	// 👇 MOVED: This is now public so k6 can stress-test the DB (and guests can view events)
	mux.HandleFunc("GET /api/events", eventHandler.HandleListEvents)

	// --- PROTECTED ROUTES (Require Login) ---
	apiMux := http.NewServeMux()

	// User Routes
	apiMux.HandleFunc("POST /users/sync", userHandler.HandleSyncUser)

	// Event Routes (Write operations still protected)
	apiMux.HandleFunc("POST /events", eventHandler.HandleCreateEvent)
	// Note: GET /events was removed from here
	apiMux.HandleFunc("PUT /events", eventHandler.HandleUpdateEvent) // Ensure Update is registered
	apiMux.HandleFunc("POST /events/invite", eventHandler.HandleInviteUser)
	apiMux.HandleFunc("POST /events/invite/bulk", eventHandler.HandleBulkInvite)
	apiMux.HandleFunc("GET /events/attendees", eventHandler.HandleListAttendees)
	apiMux.HandleFunc("GET /events/export", eventHandler.HandleExportAttendees)

	// Registration Routes
	apiMux.HandleFunc("POST /registrations", regHandler.HandleRegister)
	apiMux.HandleFunc("DELETE /registrations", regHandler.HandleCancel)
	apiMux.HandleFunc("GET /registrations/me", regHandler.HandleListMyRegistrations)

	// Admin Routes
	apiMux.HandleFunc("GET /admin/users", userHandler.HandleListUsers)
	apiMux.HandleFunc("PATCH /admin/users/role", userHandler.HandleUpdateRole)

	// Mount Protected API routes
	// The specific public route "GET /api/events" above will take precedence over this prefix match
	mux.Handle("/api/", http.StripPrefix("/api", authMiddleware(apiMux)))

	// 6. Start Server
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
