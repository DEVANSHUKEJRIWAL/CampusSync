package tests

/*
func TestRequireAuth_MissingToken(t *testing.T) {
	handler := middleware.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	req := httptest.NewRequest("GET", "/secure", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestRequireRole_Forbidden(t *testing.T) {
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	handler := middleware.RequireRole("Admin")(h)

	req := httptest.NewRequest("GET", "/", nil)
	req = injectClaims(req, "auth0|member-not-admin") // no role info
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestRequireRole_Allowed(t *testing.T) {
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.RequireRole("Member")(h)

	req := httptest.NewRequest("GET", "/", nil)
	req = injectClaimsWithRole(req, "auth0|user1", "Member")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
*/
