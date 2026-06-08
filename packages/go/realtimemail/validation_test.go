package realtimemail

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestConformanceFixtures(t *testing.T) {
	tests := []struct {
		file      string
		manifest  bool
		wantValid bool
	}{
		{"valid-manifest.acme.json", true, true},
		{"invalid-manifest.missing-keys.json", true, false},
		{"invalid-manifest.unknown-channel-property.json", true, false},
		{"valid-message.invoice.json", false, true},
		{"invalid-message.script-without-capability.json", false, false},
		{"invalid-message.unknown-property.json", false, false},
	}

	for _, test := range tests {
		t.Run(test.file, func(t *testing.T) {
			content := readFixture(t, test.file)
			var issues []ValidationIssue
			if test.manifest {
				var manifest RealtimeMailManifest
				if err := strictDecode(content, &manifest); err != nil {
					if test.wantValid {
						t.Fatal(err)
					}
					return
				}
				issues = ManifestValidator{}.Validate(manifest)
			} else {
				var message RealtimeMailMessage
				if err := strictDecode(content, &message); err != nil {
					if test.wantValid {
						t.Fatal(err)
					}
					return
				}
				issues = MessageValidator{}.Validate(message)
			}

			if test.wantValid && len(issues) > 0 {
				t.Fatalf("expected valid fixture, got issues: %#v", issues)
			}
			if !test.wantValid && len(issues) == 0 {
				t.Fatal("expected invalid fixture")
			}
		})
	}
}

func TestActionConformanceFixtures(t *testing.T) {
	tests := []struct {
		file      string
		wantValid bool
	}{
		{"valid-action.open-url.json", true},
		{"invalid-action.no-user-gesture.json", false},
		{"invalid-action.cross-domain-url.json", false},
	}

	for _, test := range tests {
		t.Run(test.file, func(t *testing.T) {
			var action RealtimeMailAction
			if err := strictDecode(readFixture(t, test.file), &action); err != nil {
				if test.wantValid {
					t.Fatal(err)
				}
				return
			}
			issues := ActionValidator{}.Validate(action)
			if test.wantValid && len(issues) > 0 {
				t.Fatalf("expected valid action, got issues: %#v", issues)
			}
			if !test.wantValid && len(issues) == 0 {
				t.Fatal("expected invalid action")
			}
		})
	}
}

func strictDecode(content []byte, value any) error {
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	return decoder.Decode(value)
}

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("unable to locate test file")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", ".."))
	content, err := os.ReadFile(filepath.Join(root, "conformance", name))
	if err != nil {
		t.Fatal(err)
	}
	return content
}
