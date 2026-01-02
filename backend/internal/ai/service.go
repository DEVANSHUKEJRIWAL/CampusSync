package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type Service struct {
	ApiKey string
}

func NewService() *Service {
	// Ensure GEMINI_API_KEY in docker-compose is set to your Groq Key (starts with 'gsk_')
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Println("⚠️ Warning: AI Key is not set.")
	}
	return &Service{ApiKey: apiKey}
}

type GroqRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type GroqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (s *Service) callGroq(prompt string) (string, error) {
	if s.ApiKey == "" {
		return "AI Service Unavailable (Missing Key)", nil
	}

	url := "https://api.groq.com/openai/v1/chat/completions"

	reqBody := GroqRequest{
		// 👇 UPDATED MODEL NAME
		Model: "llama-3.3-70b-versatile",
		Messages: []Message{
			{Role: "user", Content: prompt},
		},
	}
	jsonData, _ := json.Marshal(reqBody)

	for i := 0; i < 3; i++ {
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.ApiKey)

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()

		if resp.StatusCode == 429 {
			time.Sleep(2 * time.Second)
			continue
		}

		if resp.StatusCode != 200 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("❌ Groq API Error (Status %d): %s\n", resp.StatusCode, string(bodyBytes))
			return "AI currently busy", nil
		}

		var groqResp GroqResponse
		if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
			return "", err
		}

		if len(groqResp.Choices) > 0 {
			return groqResp.Choices[0].Message.Content, nil
		}
		return "No response from AI", nil
	}

	return "AI Limit Reached. Try again later.", nil
}

// 1. Analyze Sentiment
func (s *Service) AnalyzeSentiment(comment string) string {
	if s.ApiKey == "" {
		return "NEUTRAL"
	}
	prompt := fmt.Sprintf(`Analyze the sentiment of this event feedback. Respond with ONLY one word: "POSITIVE", "NEGATIVE", or "NEUTRAL". Feedback: "%s"`, comment)
	result, err := s.callGroq(prompt)
	if err != nil {
		return "NEUTRAL"
	}

	clean := strings.ToUpper(strings.TrimSpace(result))
	if strings.Contains(clean, "POSITIVE") {
		return "POSITIVE"
	}
	if strings.Contains(clean, "NEGATIVE") {
		return "NEGATIVE"
	}
	return "NEUTRAL"
}

// 2. Chatbot Logic
func (s *Service) ChatWithData(question string, eventContext string) (string, error) {
	prompt := fmt.Sprintf(`You are "CampusBot", a helpful assistant for university events.
    Here is the list of upcoming events in JSON format:
    %s

    Answer the student's question based ONLY on the data above. 
    If the answer isn't in the data, say "I don't have that information."
    Keep it brief and friendly.
    Student Question: "%s"`, eventContext, question)

	return s.callGroq(prompt)
}

// 3. Recommendation Logic
func (s *Service) GetRecommendations(userHistory string, upcomingEvents string) (string, error) {
	prompt := fmt.Sprintf(`Act as an event recommender.
    User's Past Events: %s
    Upcoming Events: %s

    Suggest 2 upcoming events that this user might like based on their history.
    Return the response as a simple JSON array of Event IDs only. Example: [101, 105].
    If no history, suggest the most popular ones.`, userHistory, upcomingEvents)

	return s.callGroq(prompt)
}
