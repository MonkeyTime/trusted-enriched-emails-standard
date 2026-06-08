package realtimemail

import (
	"net/url"
	"regexp"
	"strconv"
)

type ValidationIssue struct {
	Path    string
	Message string
}

type ValidationError struct {
	Issues []ValidationIssue
}

func (e ValidationError) Error() string {
	if len(e.Issues) == 0 {
		return "validation failed"
	}
	return e.Issues[0].Path + ": " + e.Issues[0].Message
}

var (
	domainPattern    = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$`)
	channelIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)
	publicKeyPattern = regexp.MustCompile(`^(ed25519|ecdsa-p256):[A-Za-z0-9_-]+={0,2}$`)
)

type ManifestValidator struct{}

func (ManifestValidator) Validate(manifest RealtimeMailManifest) []ValidationIssue {
	var issues []ValidationIssue
	if manifest.Protocol != "realtime-mail" {
		issues = append(issues, ValidationIssue{"$.protocol", "must equal realtime-mail"})
	}
	if !domainPattern.MatchString(manifest.Domain) {
		issues = append(issues, ValidationIssue{"$.domain", "must be a valid domain"})
	}
	if manifest.Version == "" {
		issues = append(issues, ValidationIssue{"$.version", "must be set"})
	}
	if manifest.DisplayName == "" {
		issues = append(issues, ValidationIssue{"$.displayName", "must be set"})
	}
	if len(manifest.PublicKeys) == 0 {
		issues = append(issues, ValidationIssue{"$.publicKeys", "must be non-empty"})
	}
	for index, key := range manifest.PublicKeys {
		if !publicKeyPattern.MatchString(key) {
			issues = append(issues, ValidationIssue{Path: "$.publicKeys[" + strconv.Itoa(index) + "]", Message: "must be a supported public key"})
		}
	}
	if len(manifest.Channels) == 0 {
		issues = append(issues, ValidationIssue{"$.channels", "must be non-empty"})
	}
	return issues
}

func (validator ManifestValidator) Parse(manifest RealtimeMailManifest) (RealtimeMailManifest, error) {
	if issues := validator.Validate(manifest); len(issues) > 0 {
		return manifest, ValidationError{Issues: issues}
	}
	return manifest, nil
}

type MessageValidator struct{}

func (MessageValidator) Validate(message RealtimeMailMessage) []ValidationIssue {
	var issues []ValidationIssue
	if message.ID == "" {
		issues = append(issues, ValidationIssue{"$.id", "must be set"})
	}
	if message.Source != Traditional && message.Source != Realtime {
		issues = append(issues, ValidationIssue{"$.source", "must be traditional or realtime"})
	}
	if !domainPattern.MatchString(message.Domain) {
		issues = append(issues, ValidationIssue{"$.domain", "must be a valid domain"})
	}
	if message.From == "" {
		issues = append(issues, ValidationIssue{"$.from", "must be set"})
	}
	if message.HTML == "" {
		issues = append(issues, ValidationIssue{"$.html", "must be set"})
	}
	if message.Source == Realtime && message.ChannelID == "" {
		issues = append(issues, ValidationIssue{"$.channelId", "is required for realtime messages"})
	}
	if message.Source == Realtime && message.Signature == "" {
		issues = append(issues, ValidationIssue{"$.signature", "is required for realtime messages"})
	}
	if message.Script != "" && !hasCapability(message.Capabilities, RunScriptSandboxed) {
		issues = append(issues, ValidationIssue{"$.capabilities", "must include run:script-sandboxed when script is present"})
	}
	return issues
}

type ActionValidator struct{}

func (ActionValidator) Validate(action RealtimeMailAction) []ValidationIssue {
	var issues []ValidationIssue
	if !channelIDPattern.MatchString(action.ID) {
		issues = append(issues, ValidationIssue{"$.id", "must be a valid action id"})
	}
	if action.MessageID == "" {
		issues = append(issues, ValidationIssue{"$.messageId", "must be set"})
	}
	if !domainPattern.MatchString(action.Domain) {
		issues = append(issues, ValidationIssue{"$.domain", "must be a valid domain"})
	}
	if action.Type != OpenURL && action.Type != PublishGatewayEvent && action.Type != RequestNotification && action.Type != StoreIsolatedValue {
		issues = append(issues, ValidationIssue{"$.type", "must be a supported action type"})
	}
	if !action.RequiresUserGesture {
		issues = append(issues, ValidationIssue{"$.requiresUserGesture", "must be true"})
	}
	if action.Type == OpenURL && !isHttpsURLForDomain(action.URL, action.Domain) {
		issues = append(issues, ValidationIssue{"$.url", "must be an https URL for the action domain"})
	}
	return issues
}

func (validator ActionValidator) Parse(action RealtimeMailAction) (RealtimeMailAction, error) {
	if issues := validator.Validate(action); len(issues) > 0 {
		return action, ValidationError{Issues: issues}
	}
	return action, nil
}

func (validator MessageValidator) Parse(message RealtimeMailMessage) (RealtimeMailMessage, error) {
	if issues := validator.Validate(message); len(issues) > 0 {
		return message, ValidationError{Issues: issues}
	}
	return message, nil
}

func hasCapability(capabilities []TrustCapability, needle TrustCapability) bool {
	for _, capability := range capabilities {
		if capability == needle {
			return true
		}
	}
	return false
}

func isHttpsURLForDomain(value string, domain string) bool {
	parsed, err := url.Parse(value)
	return err == nil && parsed.Scheme == "https" && parsed.Hostname() == domain
}
