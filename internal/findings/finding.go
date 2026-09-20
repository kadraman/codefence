// Package findings defines the unified Finding schema shared by scanners, tables, and MCP.
// CLI NDJSON wire projection lives in internal/output (feature 004), not here.
package findings

// Severity levels for findings.
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityHigh     Severity = "high"
	SeverityMedium   Severity = "medium"
	SeverityLow      Severity = "low"
)

// Confidence levels (secrets).
type Confidence string

const (
	ConfidenceLow    Confidence = "low"
	ConfidenceMedium Confidence = "medium"
	ConfidenceHigh   Confidence = "high"
)

// Kind classifies finding origin.
type Kind string

const (
	KindCode       Kind = "code"
	KindSecret     Kind = "secret"
	KindDependency Kind = "dependency"
)

// DetectionMethod describes how a secret was found.
type DetectionMethod string

const (
	DetectionRule         DetectionMethod = "rule"
	DetectionEntropy      DetectionMethod = "entropy"
	DetectionRuleEntropy  DetectionMethod = "rule+entropy"
)

// RuleVulnerableDependency is the stable deps finding rule ID.
const RuleVulnerableDependency = "vulnerable-dependency"

// Finding is the library/MCP finding schema (camelCase JSON tags).
type Finding struct {
	RuleID          string          `json:"ruleId"`
	Message         string          `json:"message"`
	FilePath        string          `json:"filePath"`
	Line            int             `json:"line"`
	Severity        Severity        `json:"severity"`
	Confidence      Confidence      `json:"confidence,omitempty"`
	Evidence        string          `json:"evidence,omitempty"`
	Remediation     string          `json:"remediation,omitempty"`
	Kind            Kind            `json:"kind,omitempty"`
	DetectionMethod DetectionMethod `json:"detectionMethod,omitempty"`
	PackageName     string          `json:"packageName,omitempty"`
	PackageVersion  string          `json:"packageVersion,omitempty"`
	AdvisoryID      string          `json:"advisoryId,omitempty"`
	CVEID           string          `json:"cveId,omitempty"`
	FixedVersion    string          `json:"fixedVersion,omitempty"`
}
