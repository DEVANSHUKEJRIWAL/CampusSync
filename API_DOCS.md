### API Documentation
This details the endpoints you built in the Go backend.

```markdown
# API Documentation


**Base URL:** `http://localhost:8080/api`
**Authentication:** Bearer Token (JWT) required for most endpoints.
```

## 👤 Users & Auth

### Sync User
Ensures the Auth0 user exists in our local PostgreSQL database.
* **POST** `/users/sync`
* **Body:** `{ "email": "user@example.com" }`
* **Response:** `200 OK` (Returns User Object)

### Admin: List Users
* **GET** `/admin/users` (Admin Only)
* **Response:** Array of all users and roles.

### Admin: Update Role
* **PATCH** `/admin/users/role` (Admin Only)
* **Body:** `{ "user_id": 1, "role": "Organizer" }`

---

## 📅 Events

### List Events (Search & Filter)
* **GET** `/events?q=hackathon&location=library`
* **Query Params:** `q` (Search text), `location` (Filter).
* **Auth:** Public (No Token Required for K6 Load Testing compatibility).

### Create Event
* **POST** `/events` (Organizer/Admin Only)
* **Body:**
    ```json
    {
      "title": "Tech Talk",
      "description": "Learn Go",
      "location": "Room 101",
      "start_time": "2023-12-01T10:00:00Z",
      "end_time": "2023-12-01T12:00:00Z",
      "capacity": 50,
      "visibility": "PUBLIC"
    }
    ```

### Update Event
* **PUT** `/events` (Organizer Only)
* **Body:** Same as Create + `"id": 1`.

---

## 🎟️ Registration & Waitlist

### Register for Event
Handles capacity checks. If full, adds to Waitlist.
* **POST** `/registrations?event_id=1`
* **Response:**
    * `200 OK`: `{ "status": "REGISTERED" }`
    * `200 OK`: `{ "status": "WAITLISTED" }`
    * `403 Forbidden`: If Private and not invited.

### Cancel Registration
Triggers automatic waitlist promotion.
* **DELETE** `/registrations?event_id=1`

### Get My Schedule
* **GET** `/registrations/me`
* **Response:** List of events user has joined.

---

## 💌 Invitations (Private Events)

### Invite Single User
* **POST** `/events/invite`
* **Body:** `{ "event_id": 1, "email": "student@test.com" }`

### Bulk Invite (CSV)
* **POST** `/events/invite/bulk`
* **Body:** Multipart Form Data (`file`: `.csv`)
* **CSV Format:** First column must be email.

### Manage Attendees
* **GET** `/events/attendees?event_id=1`
* **GET** `/events/export?event_id=1` (Downloads CSV)