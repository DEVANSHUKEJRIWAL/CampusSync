# Database Schema

The system uses **PostgreSQL 15**.

## ENUM Types
* **`event_status`**: `UPCOMING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
* **`event_visibility`**: `PUBLIC`, `PRIVATE`
* **`registration_status`**: `REGISTERED`, `CANCELLED`

## Tables

### 1. `users`
Stores local reference to Auth0 identities.
* `id`: BIGSERIAL (PK)
* `email`: VARCHAR (Unique)
* `oidc_id`: VARCHAR (Unique - from Auth0)
* `role`: VARCHAR (Default 'Member')

### 2. `events`
Stores event metadata.
* `id`: BIGSERIAL (PK)
* `organizer_id`: INT (FK -> users.id)
* `title`, `description`, `location`: TEXT
* `start_time`, `end_time`: TIMESTAMP
* `capacity`: INT
* `status`: event_status
* `visibility`: event_visibility

### 3. `registrations`
Tracks active attendees.
* `id`: BIGSERIAL (PK)
* `user_id`: INT (FK)
* `event_id`: INT (FK)
* `status`: registration_status
* **Constraint:** UNIQUE(user_id, event_id) - Prevents double booking.

### 4. `waitlist`
Queue for full events. Uses `created_at` to determine priority (FIFO).
* `id`: BIGSERIAL (PK)
* `user_id`, `event_id`: FKs
* `created_at`: TIMESTAMP (Used for sorting promotion order)

### 5. `invitations`
Allowlist for Private events.
* `event_id`: INT (FK)
* `email`: VARCHAR
* **Constraint:** UNIQUE(event_id, email)

## Key Relationships

* **One-to-Many:** A User can organize many Events.
* **Many-to-Many:** Users register for Events (via `registrations` table).