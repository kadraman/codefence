package secret

import (
	"bytes"
	"fmt"
	"os"
)

// readTextFile reads a file; returns (nil, nil) when content looks binary (NUL).
func readTextFile(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	if bytes.IndexByte(data, 0) >= 0 {
		return nil, nil
	}
	return data, nil
}
