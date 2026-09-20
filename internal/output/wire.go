// Package output renders scan findings as table or CLI NDJSON.
// Wire field names are independent of internal/findings JSON tags (feature 003).
package output

import (
	"io"

	"github.com/kadraman/codefence/internal/findings"
)

// Format is the user-facing output format.
type Format string

const (
	FormatTable Format = "table"
	FormatJSON  Format = "json"
)

// Options control stream destinations and quiet/verbose behavior.
type Options struct {
	Format  Format
	Quiet   bool
	Verbose bool
	Color   bool // false forces no ANSI (also auto when not a TTY)
}

// Streams holds writers for findings vs progress.
type Streams struct {
	Findings io.Writer
	Progress io.Writer
}

// ResolveStreams picks destinations per format (FR-001).
func ResolveStreams(format Format, stdout, stderr io.Writer) Streams {
	if format == FormatJSON {
		return Streams{Findings: stdout, Progress: stderr}
	}
	return Streams{Findings: stderr, Progress: stdout}
}

// ShowProgress reports whether progress/status lines should be printed.
// JSON is quiet unless Verbose; Quiet suppresses; Verbose forces progress.
func ShowProgress(opts Options) bool {
	if opts.Quiet {
		return false
	}
	if opts.Format == FormatJSON {
		return opts.Verbose
	}
	return true
}

// WireFinding is the CLI NDJSON finding object (not findings.Finding).
type WireFinding struct {
	Category        string         `json:"category"`
	Severity        string         `json:"severity"`
	Package         *string        `json:"package"`
	Version         *string        `json:"version"`
	Fixed           *string        `json:"fixed"`
	CVE             *string        `json:"cve"`
	Filename        string         `json:"filename"`
	Location        *WireLocation  `json:"location"`
	RuleID          string         `json:"ruleId"`
	AdvisoryID      *string        `json:"advisoryId"`
	Message         string         `json:"message"`
	Confidence      *string        `json:"confidence"`
	Evidence        *string        `json:"evidence"`
	Remediation     *string        `json:"remediation"`
	Kind            *string        `json:"kind"`
	DetectionMethod *string        `json:"detectionMethod"`
}

// WireLocation is the NDJSON location object.
type WireLocation struct {
	Line int `json:"line"`
}

// WireWarning is an NDJSON warning object.
type WireWarning struct {
	Category    string `json:"category"`
	Aspect      string `json:"aspect"`
	Code        string `json:"code"`
	Message     string `json:"message"`
	Filename    string `json:"filename"`
	Remediation string `json:"remediation"`
}

// MapFinding converts a library Finding into the CLI NDJSON wire shape.
// aspect must be "code" or "deps" (registry IDs); category becomes "code" or "dependency".
func MapFinding(f findings.Finding, aspect string) WireFinding {
	category := "code"
	if aspect == "deps" || f.Kind == findings.KindDependency {
		category = "dependency"
	}
	// Secrets from the code aspect stay category "code" with kind "secret".
	w := WireFinding{
		Category: category,
		Severity: string(f.Severity),
		Filename: f.FilePath,
		RuleID:   f.RuleID,
		Message:  f.Message,
		Package:  strPtrOrNil(f.PackageName),
		Version:  strPtrOrNil(f.PackageVersion),
		CVE:      strPtrOrNil(f.CVEID),
		AdvisoryID: strPtrOrNil(f.AdvisoryID),
		Confidence: strPtrOrNil(string(f.Confidence)),
		Evidence:   strPtrOrNil(f.Evidence),
		Remediation: strPtrOrNil(f.Remediation),
		Kind:            strPtrOrNil(string(f.Kind)),
		DetectionMethod: strPtrOrNil(string(f.DetectionMethod)),
	}
	if f.FixedVersion != "" {
		fixed := ">= " + f.FixedVersion
		w.Fixed = &fixed
	}
	if f.Line > 0 {
		w.Location = &WireLocation{Line: f.Line}
	}
	return w
}

// NewWarning builds a wire warning object.
func NewWarning(aspect, code, message, filename, remediation string) WireWarning {
	return WireWarning{
		Category:    "warning",
		Aspect:      aspect,
		Code:        code,
		Message:     message,
		Filename:    filename,
		Remediation: remediation,
	}
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
