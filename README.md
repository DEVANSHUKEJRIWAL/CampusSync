# 🎓 CampusSync – Gamified Campus Event Management

![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)
![Go](https://img.shields.io/badge/Go-1.22-blue?logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

**CampusSync** is a full-stack, gamified campus event management platform that increases student engagement through points, badges, streaks, and leaderboards.  
It combines a **React + TypeScript frontend**, a **high-performance Go backend**, and **PostgreSQL**, all fully **Dockerized** for easy local setup and demos.

---

## 🚀 Key Features

### 🏆 Gamification & Engagement
- **Points System** – Earn points for registering and attending events
- **Digital Badges** – Auto-awarded achievements (e.g., *Newcomer*, *Campus Hero*)
- **Leaderboard** – Real-time campus-wide rankings
- **Attendance Streaks** – Track consecutive participation
- **Photo Gallery** – View event highlights
- **Live Comments** – Discuss events in real time

---

### 📅 Advanced Event Management
- **Recurring Events** – Daily, weekly, or custom schedules
- **Custom Registration Fields** – Dynamic questions per event
- **Ticket Types** – VIP, General Admission, capacity-based tiers
- **Event Lifecycle Automation** –  
  `UPCOMING → IN_PROGRESS → COMPLETED`
- **Visibility Controls** – Public or invite-only events

---

### 🎟️ Registration & Check-in
- **QR Code Tickets** – Unique QR per registration
- **Kiosk Mode** – Real-time QR scanning for organizers
- **Waitlist Engine** – Auto-promotion when slots open
- **Conflict Detection** – Prevents overlapping registrations

---

### 📊 Organizer Dashboard & Analytics
- **Live Analytics** – Registrations, attendance %, engagement
- **Attendee Management** – View & export CSVs
- **Bulk Invites** – Upload via CSV or email lists
- **Feedback System** – Ratings and post-event reviews

---

### 🔐 Authentication & Security
- **OpenID Connect (Auth0)** – Google & GitHub login
- **RBAC (Role-Based Access Control)**:
  - **Admin** – Full system control & analytics
  - **Organizer** – Create events, manage check-ins
  - **Member** – Register, attend, earn rewards

---

## 🧱 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Go 1.22, Gin, `lib/pq` |
| Database | PostgreSQL 15 |
| Auth | Auth0 (OIDC) |
| Infra | Docker, Docker Compose |
| Deployment | Render (Backend), Vercel (Frontend) |

---

## Prerequisites

- Docker Desktop (running)
- Git

---

## ⚙️ Configuration

### 🔐 Auth0 Setup

1. Create a **Single Page Application**
2. Create an **API**
   - Identifier: `http://localhost:8080`
3. Copy **Domain**, **Client ID**, and **Audience**

#### Frontend (`frontend/src/main.tsx`)
```ts
const domain = "YOUR_AUTH0_DOMAIN";
const clientId = "YOUR_CLIENT_ID";
const audience = "http://localhost:8080";

Backend (backend/cmd/api/main.go)

auth0Domain := "YOUR_AUTH0_DOMAIN"
auth0Audience := "http://localhost:8080"


⸻

🛠️ Setup Instructions

1. Clone the Repository

git clone <repository-url>
cd CampusSync


⸻

2. Start the Application

docker-compose up --build

This spins up:
	•	Go backend
	•	React frontend
	•	PostgreSQL database

⸻

3. Database Migration (Required)

Apply the schema while containers are running:

cat backend/db/migrations/*.sql | docker exec -i cems_db psql -U postgres -d cems

⸻

4. Access the App

http://localhost:5173


⸻

5. Admin Setup (First Run)

Promote your user to Admin:

docker exec -i cems_db psql -U postgres -d cems \
-c "UPDATE users SET role='Admin', points=50 WHERE email='YOUR_EMAIL@gmail.com';"


⸻

🧪 Feature Testing

🏅 Gamification
	1.	Sign up → Automatically receive 50 points + Newcomer badge
	2.	Attend an event → +10 points
	3.	Check leaderboard updates live

⸻

📱 Kiosk Mode
	1.	Login as Admin / Organizer
	2.	Open event → Launch Kiosk Mode
	3.	Scan attendee QR codes
	4.	Status updates instantly

⸻

🗓️ Waitlist Flow
	1.	Event capacity = 1
	2.	User A registers → Registered
	3.	User B registers → Waitlisted
	4.	User A cancels → User B auto-promoted

⸻

📁 Project Structure

CampusSync/
├── backend/
│   ├── cmd/api/            # App entrypoint
│   ├── internal/
│   │   ├── auth/           # JWT & RBAC middleware
│   │   ├── events/         # Events, kiosk, analytics
│   │   ├── users/          # Gamification logic
│   │   ├── registration/   # QR codes & waitlist engine
│   │   └── store/          # SQL repositories
│   ├── db/migrations/      # Database schema
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Dashboards, Kiosk, Leaderboard
│   │   ├── context/        # Toast & global state
│   │   └── main.tsx        # Auth0 provider
│   └── Dockerfile
└── docker-compose.yml


⸻

📜 License

This project is licensed under the MIT License.
