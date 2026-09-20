package scan

import (
	"fmt"

	"github.com/kadraman/codefence/internal/output"
)

func logAspectStatus(w *output.Writer, o AspectOutcome) {
	switch o.Status {
	case StatusOK:
		msg := fmt.Sprintf("[%s] OK", o.Aspect)
		if o.Message != "" {
			msg += " — " + o.Message
		}
		w.Progress("%s", msg)
	case StatusSkipped:
		msg := fmt.Sprintf("[%s] SKIPPED", o.Aspect)
		if o.Message != "" {
			msg += " — " + o.Message
		}
		w.Progress("%s", msg)
	case StatusFailed:
		msg := fmt.Sprintf("[%s] FAILED", o.Aspect)
		if o.Message != "" {
			msg += " — " + o.Message
		}
		w.Progress("%s", msg)
	}
}
