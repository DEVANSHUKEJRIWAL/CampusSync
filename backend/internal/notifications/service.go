package notifications

import (
	"log"
	"time"
)

type Service struct {
}

func NewService() *Service {
	return &Service{}
}

// SendRegistrationEmail simulates sending a confirmation email
// We run this in a goroutine so it doesn't slow down the HTTP response
func (s *Service) SendRegistrationEmail(toEmail, eventTitle string) {
	go func() {
		// Simulate network delay
		time.Sleep(2 * time.Second)

		log.Printf("📧 [EMAIL SENT] To: %s | Subject: Registration Confirmed! | Body: You are going to %s!", toEmail, eventTitle)
	}()
}

// SendWaitlistEmail simulates the waitlist notification
func (s *Service) SendWaitlistEmail(toEmail, eventTitle string) {
	go func() {
		time.Sleep(2 * time.Second)

		log.Printf("⚠️ [EMAIL SENT] To: %s | Subject: Added to Waitlist | Body: You are on the waitlist for %s.", toEmail, eventTitle)
	}()
}
