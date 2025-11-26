FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o cems-api ./cmd/api

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/cems-api .
EXPOSE 8080
CMD ["./cems-api"]