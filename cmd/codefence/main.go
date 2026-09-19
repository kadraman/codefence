package main

import (
	"os"

	"github.com/kadraman/codefence/internal/cli"
)

func main() {
	os.Exit(cli.Main(os.Args[1:]))
}
