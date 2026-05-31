module example.com/vulnerable-go-app

go 1.21

require (
	golang.org/x/crypto v0.16.0
	github.com/go-jose/go-jose/v3 v3.0.0
)

require (
	github.com/google/uuid v1.6.0 // indirect
)
