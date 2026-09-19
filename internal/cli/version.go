package cli

import "fmt"

// Set via -ldflags "-X github.com/kadraman/codefence/internal/cli.version=... -X ...commit=..."
var (
	version = "dev"
	commit  = "none"
)

func printVersion() {
	fmt.Fprintf(Stdout, "codefence %s (%s)\n", version, commit)
}
