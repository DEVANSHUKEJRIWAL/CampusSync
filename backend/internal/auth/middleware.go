package auth

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/jwks"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

// CustomClaims contains custom data we might want from the token
type CustomClaims struct {
	Scope string `json:"scope"`
}

func (c *CustomClaims) Validate(ctx context.Context) error {
	return nil
}

// EnsureValidToken is a middleware that will check the validity of our JWT.
func EnsureValidToken(domain string, audience string) func(next http.Handler) http.Handler {
	// 1. Setup the URL to fetch Auth0's public keys
	issuerURL, err := url.Parse("https://" + domain + "/")
	if err != nil {
		log.Fatalf("Failed to parse the issuer url: %v", err)
	}

	// 2. Create a provider to cache the public keys (JWKS)
	provider := jwks.NewCachingProvider(issuerURL, 5*time.Minute)

	// 3. Set up the validator
	jwtValidator, err := validator.New(
		provider.KeyFunc,
		validator.RS256,
		issuerURL.String(),
		[]string{audience},
		validator.WithCustomClaims(func() validator.CustomClaims {
			return &CustomClaims{}
		}),
		validator.WithAllowedClockSkew(time.Minute),
	)

	if err != nil {
		log.Fatalf("Failed to set up the jwt validator: %v", err)
	}

	// 4. Create the middleware handler
	middleware := jwtmiddleware.New(
		jwtValidator.ValidateToken,
		jwtmiddleware.WithErrorHandler(func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("Encountered error while validating JWT: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"message":"Failed to validate JWT."}`))
		}),
	)

	// 5. Return the function that wraps the next handler
	return func(next http.Handler) http.Handler {
		return middleware.CheckJWT(next)
	}
}
