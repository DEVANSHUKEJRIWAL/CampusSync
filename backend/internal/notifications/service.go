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

func (s *Service) SendRegistrationEmail(toEmail, eventTitle string) {
	go func() {
		time.Sleep(2 * time.Second)

		log.Printf("📧 [EMAIL SENT] To: %s | Subject: Registration Confirmed! | Body: You are going to %s!", toEmail, eventTitle)
	}()
}

func (s *Service) SendWaitlistEmail(toEmail, eventTitle string) {
	go func() {
		time.Sleep(2 * time.Second)

		log.Printf("⚠️ [EMAIL SENT] To: %s | Subject: Added to Waitlist | Body: You are on the waitlist for %s.", toEmail, eventTitle)
	}()
}
