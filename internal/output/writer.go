package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/kadraman/codefence/internal/findings"
)

// Writer emits findings and progress according to Options.
type Writer struct {
	opts    Options
	streams Streams
	color   bool
}

// NewWriter constructs an output writer. colorEnabled is ignored when format is json
// or when Color is forced false; TTY detection applies when Color is true and stdout/stderr
// look like terminals.
func NewWriter(opts Options, stdout, stderr io.Writer) *Writer {
	streams := ResolveStreams(opts.Format, stdout, stderr)
	color := false
	if opts.Format == FormatTable && opts.Color {
		color = isTTY(stderr)
	}
	return &Writer{opts: opts, streams: streams, color: color}
}

// WriteFinding emits one finding (table row batching is caller-driven via WriteTable).
func (w *Writer) WriteFinding(f findings.Finding, aspect string) error {
	if w.opts.Format == FormatJSON {
		wire := MapFinding(f, aspect)
		return writeJSONLine(w.streams.Findings, wire)
	}
	// Single-finding table path: print a compact line (full tables use WriteTable).
	_, err := fmt.Fprintf(w.streams.Findings, "%s\t%s\t%s:%d\t%s\n",
		strings.ToUpper(string(f.Severity)), f.RuleID, f.FilePath, f.Line, f.Message)
	return err
}

// WriteWarning emits a warning NDJSON object or a human warning line.
func (w *Writer) WriteWarning(warn WireWarning) error {
	if w.opts.Format == FormatJSON {
		return writeJSONLine(w.streams.Findings, warn)
	}
	_, err := fmt.Fprintf(w.streams.Findings, "warning[%s]: %s (%s)\n", warn.Aspect, warn.Message, warn.Filename)
	return err
}

// Progress writes a progress/status line when ShowProgress allows it.
func (w *Writer) Progress(format string, args ...any) {
	if !ShowProgress(w.opts) {
		return
	}
	msg := fmt.Sprintf(format, args...)
	if w.color {
		msg = dim(msg)
	}
	fmt.Fprintln(w.streams.Progress, msg)
}

// WriteTable prints findings for one aspect (colored table or NDJSON lines).
// aspect must be the registry ID ("code" or "deps") so JSON category follows the wire contract.
func (w *Writer) WriteTable(aspect, title string, list []findings.Finding) error {
	if w.opts.Format == FormatJSON {
		for _, f := range list {
			if err := w.WriteFinding(f, aspect); err != nil {
				return err
			}
		}
		return nil
	}
	if len(list) == 0 {
		return nil
	}
	sorted := append([]findings.Finding(nil), list...)
	sort.SliceStable(sorted, func(i, j int) bool {
		return severityRank(sorted[i].Severity) < severityRank(sorted[j].Severity)
	})
	if title != "" {
		line := title
		if w.color {
			line = boldYellow(line)
		}
		if _, err := fmt.Fprintln(w.streams.Findings, line); err != nil {
			return err
		}
	}
	header := "Severity\tRule\tFilename\tLine\tMessage"
	if w.color {
		header = yellow(header)
	}
	if _, err := fmt.Fprintln(w.streams.Findings, header); err != nil {
		return err
	}
	for _, f := range sorted {
		sev := strings.ToUpper(string(f.Severity))
		if w.color {
			sev = colorSeverity(f.Severity, sev)
		}
		if _, err := fmt.Fprintf(w.streams.Findings, "%s\t%s\t%s\t%d\t%s\n",
			sev, f.RuleID, f.FilePath, f.Line, f.Message); err != nil {
			return err
		}
	}
	return nil
}

// AggregateDeps groups findings by package@version for table display (FR-006).
func AggregateDeps(list []findings.Finding) []findings.Finding {
	type key struct{ name, ver string }
	seen := map[key]findings.Finding{}
	order := []key{}
	for _, f := range list {
		k := key{f.PackageName, f.PackageVersion}
		if _, ok := seen[k]; !ok {
			seen[k] = f
			order = append(order, k)
		}
	}
	out := make([]findings.Finding, 0, len(order))
	for _, k := range order {
		out = append(out, seen[k])
	}
	return out
}

func writeJSONLine(w io.Writer, v any) error {
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	return enc.Encode(v)
}

func severityRank(s findings.Severity) int {
	switch s {
	case findings.SeverityCritical:
		return 0
	case findings.SeverityHigh:
		return 1
	case findings.SeverityMedium:
		return 2
	default:
		return 3
	}
}

func isTTY(w io.Writer) bool {
	f, ok := w.(*os.File)
	if !ok {
		return false
	}
	fi, err := f.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

func colorSeverity(s findings.Severity, text string) string {
	switch s {
	case findings.SeverityCritical:
		return "\033[1;91m" + text + "\033[0m"
	case findings.SeverityHigh:
		return "\033[31m" + text + "\033[0m"
	case findings.SeverityMedium:
		return "\033[38;5;208m" + text + "\033[0m"
	default:
		return "\033[38;5;178m" + text + "\033[0m"
	}
}

func boldYellow(s string) string { return "\033[1;33m" + s + "\033[0m" }
func yellow(s string) string     { return "\033[33m" + s + "\033[0m" }
func dim(s string) string        { return "\033[2m" + s + "\033[0m" }
