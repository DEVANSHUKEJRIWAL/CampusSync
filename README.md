# CampusSync – Campus Event Management System (CEMS)

![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)
![Go](https://img.shields.io/badge/Go-1.22-blue?logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

CampusSync is a full-stack **Campus Event Management System (CEMS)** that centralizes event discovery, registration, and management for universities. It bundles a modern React frontend, a performant Go backend, and PostgreSQL storage—fully Dockerized for easy local development or demo.

---

## Key Features

### 1. Authentication & Security
- OpenID Connect via **Auth0** (supports Google/GitHub logins)
- **Role-Based Access Control (RBAC)**: Admin, Organizer, Member
- **JWT-protected API** endpoints (middleware validation)

### 2. Event Management
- Organizer **CRUD** (Create, Read, Update, Delete) for events
- **Public** and **Private** event visibility modes
- Background workers automatically transition event status:
  `UPCOMING → IN_PROGRESS → COMPLETED`

### 3. Registration Engine
- Enforced **capacity** using DB transactions
- **Waitlist** with automatic promotion on cancellations
- **Conflict detection** to prevent double-booking
- Mocked email notifications on promotions/cancellations

### 4. Organizer Tools
- View registered and waitlisted attendees
- **CSV export** of attendee lists
- **Bulk CSV invitations** and manual invites by email

### 5. UX
- **List view** and **Calendar view** (monthly/weekly)
- Real-time **search & filter**
- **My Schedule** dashboard for registered users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, React Big Calendar |
| Backend | Go 1.22, `net/http`, `lib/pq` |
| Database | PostgreSQL 15 |
| Infra | Docker, Docker Compose |
| Auth | Auth0 (OpenID Connect) |

---

## Prerequisites

- Docker Desktop (running)
- Git

---

## Configuration

### Auth0
#### Create an Auth0 Application and set the following values in the frontend and backend.
```
Go to https://manage.auth0.com
Applications → Applications → Create Application
Type: Single Page Web Application
Stack/Framework: React (doesn’t matter, just means SPA).
```
#### Create Auth0 API
```
You need this so the backend can verify tokens.
Auth0 → Applications → APIs
Create API
Give it:
Name: CEMS API
Identifier: http://localhost:8080
Signing Algorithm: RS256
Save.
```
Find the domain(YOUR_AUTH0_DOMAIN) and clientID(YOUR_CLIENT_ID) on the Application → Settings

**Frontend** — `frontend/src/main.tsx`:
```ts
const domain = "YOUR_AUTH0_DOMAIN";
const clientId = "YOUR_CLIENT_ID";
const audience = "http://localhost:8080";
```

**Backend** — `backend/cmd/api/main.go`:
```ts
auth0Domain := "YOUR_AUTH0_DOMAIN"
auth0Audience := "http://localhost:8080"
```
---

## Setup Instructions
This project is fully Dockerized for easy setup.

### 1. Clone the Repository

```Bash
git clone <repository-url>
cd CampusSync
```
### 2. Start the Application  
Run the following command in the root directory:
```Bash
docker-compose up --build
```
This will build the Go Backend, the React Frontend, and spin up the PostgreSQL database.

### 3. Database Setup (Required Before First Login)  
This app does not create database tables automatically. You must import the SQL schema after the database container is running.

Run the command from the project root:

```
cat backend/db/migrations/*.sql | docker exec -i cems_db psql -U postgres -d cems
```

This will apply all migration files in backend/db/migrations and create the required tables (e.g., users, events, etc.).  

**Only run this once, unless you reset your Docker volume.**


### 4. Access the App
Open your browser and navigate to:  
http://localhost:5173

### 5. Admin Setup (First Run)  
By default, all new users are created with the "Member" role. To unlock Organizer/Admin features, you must manually promote your first user via the database.  

- Log in to the app via the browser.  
- Open a new terminal window.  
- Run the following command to promote yourself to Admin:

```Bash
docker exec -i cems_db psql -U postgres -d cems -c "UPDATE users SET role='Admin' WHERE email='YOUR_EMAIL@gmail.com';"
```
**(Replace YOUR_EMAIL@gmail.com with the email you used to log in).**

- Refresh the browser. You will now see the Admin Console and Create Event options.

---

## Testing Specific Features
- Testing the Waitlist.
- Create an event with Capacity: 1.
- Register with User A. (Status: Registered).
- Log in with User B (incognito/different browser) and register. (Status: Waitlisted).
- As User A, cancel your registration.
- User B will automatically be promoted to Registered. Check the backend logs for the email notification.
- Testing Private Events.
- Create an event with Visibility: Private.
- Try to join as a normal user (Access Denied).
- As the organizer, use the Invite or Bulk CSV button to invite the user's email.
- Try to join again (Success).

---
```
Project Structure
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
