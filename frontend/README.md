## CampusSync – Campus Event Management System (CEMS)

![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)
![Go](https://img.shields.io/badge/Go-1.22-blue?logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)

**CampusSync** is a production-grade, full-stack web application designed to centralize event discovery, registration, and management for university campuses. It solves the problem of fragmented event coordination by providing a single platform for Admins, Organizers, and Students.

---

## 🚀 Key Features Implemented

### 🔐 Security & Authentication
* **OIDC Integration:** Authentication delegated to Auth0 (Google/GitHub logins).
* **RBAC (Role-Based Access Control):** Middleware enforcement for `Admin`, `Organizer`, and `Member` roles.
* **Secure API:** JWT validation on all protected endpoints.

### 📅 Advanced Event Management
* **Lifecycle Automation:** Background Go routines automatically transition event status (`UPCOMING` → `IN_PROGRESS` → `COMPLETED`) based on time.
* **Visibility Controls:** * **Public:** Open to all members.
    * **Private:** Registration restricted to invited emails only.
* **Calendar View:** Integrated `React-Big-Calendar` for monthly/weekly visualization.

### 🎟️ Intelligent Registration Engine
* **Concurrency-Safe Capacity:** Uses database transactions (ACID) to prevent over-booking.
* **Automated Waitlists:** Users are queued when capacity is full.
* **Smart Promotion:** When a spot opens (cancellation), the system *automatically* promotes the next person in the waitlist and sends a notification.

### 👥 Organizer Tooling
* **Bulk CSV Invitations:** Upload a CSV to invite hundreds of users instantly.
* **Attendee Management:** View real-time lists of registered vs. waitlisted users.
* **Data Export:** Download attendee lists as `.csv`.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript | Vite-based SPA, CSS Modules, Heroicons. |
| **Backend** | Go (Golang) 1.22 | Standard `net/http`, `lib/pq` driver, Modular Monolith structure. |
| **Database** | PostgreSQL 15 | Relational data, ENUMs, Foreign Keys. |
| **Infrastructure** | Docker | `docker-compose` for orchestration. |
| **Testing** | Vitest, Playwright, k6 | Full coverage: Unit, E2E, and Load testing. |

---

## ⚙️ Setup & Configuration

### 1. Prerequisites
* Docker Desktop (Running)
* Git

### 2. Auth0 Configuration
You must create a Single Page Application in [Auth0](https://auth0.com/) and update the code.

* **Frontend (`frontend/src/main.tsx`):**
    ```typescript
    const domain = "YOUR_AUTH0_DOMAIN";
    const clientId = "YOUR_CLIENT_ID";
    const audience = "http://localhost:8080";
    ```
* **Backend (`backend/cmd/api/main.go`):**
    ```go
    auth0Domain := "YOUR_AUTH0_DOMAIN"
    auth0Audience := "http://localhost:8080"
    ```

### 3. Running the Application
Use Docker Compose to spin up the Database, Backend, and Frontend simultaneously.

```bash
  docker-compose up --build
```

```
📂 Project Structure
CampusSync/
├── backend/
│   ├── cmd/api/main.go       # Application Entrypoint
│   ├── internal/
│   │   ├── auth/             # JWT Middleware & CORS
│   │   ├── background/       # Background Status Updater
│   │   ├── events/           # Event Logic & Handlers
│   │   ├── registration/     # Waitlist & Registration Logic
│   │   ├── store/            # Database Repositories (SQL)
│   │   └── notifications/    # Mock Email Service
│   ├── db/migrations/        # SQL Schema Definitions
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/       # UI Components (EventDashboard, CalendarView)
│   │   ├── context/          # Global Contexts (Toast)
│   │   ├── App.tsx           # Main Layout & Auth Logic
│   │   └── main.tsx          # Auth0 Provider Setup
│   └── Dockerfile
├── docker-compose.yml        # Container Orchestration
└── README.md
```