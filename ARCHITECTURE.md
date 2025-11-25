# System Architecture & Implementation Details

## Architecture Pattern
CampusSync follows a **3-Tier Architecture** implemented as a **Modular Monolith**.
* **Presentation:** React (Vite) + CSS Modules.
* **Logic:** Go (Golang) REST API.
* **Data:** PostgreSQL.

## Core Logic Workflows

### 1. Concurrency-Safe Registration
To prevent race conditions (e.g., 2 people booking the last seat at the same millisecond), the `RegisterUserForEvent` function uses **Database Transactions**:
1.  `BeginTx`: Start transaction.
2.  `Lock Rows`: Query current count.
3.  **Logic:**
    * If `count < capacity`: Insert into `registrations`.
    * If `count >= capacity`: Insert into `waitlist`.
4.  `Commit`: Save changes.

### 2. Automatic Waitlist Promotion
When a user cancels (`DELETE /registrations`), the system:
1.  Deletes the record.
2.  Queries the `waitlist` table, ordered by `created_at ASC` (First-In-First-Out).
3.  If a user is found:
    * Removes them from `waitlist`.
    * Inserts them into `registrations`.
    * **Triggers Async Notification:** Sends an email in a Goroutine (non-blocking).

### 3. Background Status Updater
A Go routine runs in the background (`internal/background/status_updater.go`).
* **Mechanism:** `time.NewTicker(1 * time.Minute)`
* **Action:**
    * Update `UPCOMING` -> `IN_PROGRESS` if `start_time` passed.
    * Update `IN_PROGRESS` -> `COMPLETED` if `end_time` passed.

### 4. Frontend Resilience
* **Error Boundary:** A wrapper component catches React rendering errors to prevent White Screens of Death.
* **Context API:** A global `ToastContext` manages notifications, replacing native browser alerts.
* **CSS Variables:** Global theming (`index.css`) ensures consistent Dark/Light mode support.

## Security Implementation
1.  **Middleware:** `auth.EnsureValidToken` validates JWTs from Auth0.
2.  **CORS:** Configured to allow only the frontend origin.
3.  **Input Validation:** All request structs have a `.Validate()` method (e.g., checking end_time > start_time).