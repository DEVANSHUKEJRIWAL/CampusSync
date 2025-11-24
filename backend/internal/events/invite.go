package events

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
)

func (h *Handler) HandleBulkInvite(w http.ResponseWriter, r *http.Request) {
	// 1. Parse Multipart Form (10 MB max)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// 2. Get Event ID
	eventIDStr := r.FormValue("event_id")
	eventID, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid event ID", http.StatusBadRequest)
		return
	}

	// 3. Get the File
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 4. Parse CSV
	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Invalid CSV format", http.StatusBadRequest)
		return
	}

	// 5. Extract Emails (Assume email is in the first column)
	var emails []string
	for _, row := range records {
		if len(row) > 0 {
			emails = append(emails, row[0])
		}
	}

	// 6. Save to DB
	count, err := h.Repo.BulkInvite(r.Context(), eventID, emails)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// 7. Respond
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Bulk invite processed",
		"count":   count,
	})
}
