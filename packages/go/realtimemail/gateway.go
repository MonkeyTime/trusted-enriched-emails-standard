package realtimemail

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"strings"
	"time"
)

type HostActionBroker struct {
	TrustPolicy *TrustPolicy
	Verifier    SignatureVerifier
}

func (broker HostActionBroker) Authorize(action RealtimeMailAction, message RealtimeMailMessage, manifest RealtimeMailManifest, userGesture bool, now time.Time) (RealtimeMailAction, error) {
	if issues := (ActionValidator{}).Validate(action); len(issues) > 0 {
		return action, errors.New("invalid_action")
	}
	if action.MessageID != message.ID {
		return action, errors.New("message_mismatch")
	}
	if action.Domain != message.Domain || action.Domain != manifest.Domain {
		return action, errors.New("domain_mismatch")
	}
	if broker.TrustPolicy == nil || !broker.TrustPolicy.IsTrusted(action.Domain) {
		return action, errors.New("domain_not_trusted")
	}
	if !userGesture || !action.RequiresUserGesture {
		return action, errors.New("user_gesture_required")
	}
	if !message.ExpiresAt.IsZero() && !message.ExpiresAt.After(now) {
		return action, errors.New("message_expired")
	}
	if !broker.verifyWithManifestKey(message, manifest) {
		return action, errors.New("signature_required")
	}
	if action.Type == OpenURL && !hasCapability(message.Capabilities, OpenURLUserGesture) {
		return action, errors.New("capability_required")
	}
	if isPaymentRequest(action.Payload) && !hasCapability(message.Capabilities, PaymentRequestUserGesture) {
		return action, errors.New("capability_required")
	}
	return action, nil
}

func (broker HostActionBroker) verifyWithManifestKey(message RealtimeMailMessage, manifest RealtimeMailManifest) bool {
	for _, key := range manifest.PublicKeys {
		if strings.HasPrefix(key, "ed25519:") && broker.Verifier.VerifyEd25519(message, key) {
			return true
		}
	}
	return false
}

type RealtimeMessageBuilder struct {
	Manifest RealtimeMailManifest
	Clock    func() time.Time
}

func (builder RealtimeMessageBuilder) Build(input RealtimeMessageInput) (RealtimeMailMessage, error) {
	channel, ok := builder.channel(input.ChannelID)
	if !ok {
		return RealtimeMailMessage{}, errors.New("unknown_channel")
	}
	clock := builder.Clock
	if clock == nil {
		clock = time.Now
	}
	capabilities := input.Capabilities
	if capabilities == nil {
		capabilities = channel.Capabilities
	}
	message := RealtimeMailMessage{
		ID:           input.ID,
		Source:       Realtime,
		Domain:       builder.Manifest.Domain,
		ChannelID:    channel.ID,
		From:         input.From,
		Subject:      input.Subject,
		HTML:         input.HTML,
		CSS:          input.CSS,
		Script:       input.Script,
		Capabilities: capabilities,
		ReceivedAt:   clock(),
		ExpiresAt:    input.ExpiresAt,
	}
	if message.ID == "" {
		message.ID = "generated-message"
	}
	validationMessage := message
	validationMessage.Signature = "unsigned-builder-placeholder"
	if issues := (MessageValidator{}).Validate(validationMessage); len(issues) > 0 {
		return message, ValidationError{Issues: issues}
	}
	message.Signature = ""
	return message, nil
}

func (builder RealtimeMessageBuilder) channel(id string) (RealtimeMailChannel, bool) {
	for _, channel := range builder.Manifest.Channels {
		if channel.ID == id {
			return channel, true
		}
	}
	return RealtimeMailChannel{}, false
}

type RealtimeMessageInput struct {
	ID           string
	ChannelID    string
	From         string
	Subject      string
	HTML         string
	CSS          string
	Script       string
	Capabilities []TrustCapability
	ExpiresAt    time.Time
}

type MessageSigner struct {
	Verifier SignatureVerifier
}

func (signer MessageSigner) SignEd25519(message RealtimeMailMessage, privateKey ed25519.PrivateKey) (RealtimeMailMessage, error) {
	message.Signature = ""
	canonical, err := signer.Verifier.CanonicalMessage(message)
	if err != nil {
		return message, err
	}
	signature := ed25519.Sign(privateKey, []byte(canonical))
	message.Signature = "rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0." + base64.RawURLEncoding.EncodeToString(signature)
	return message, nil
}

type RouteAuthorizer struct {
	Manifest RealtimeMailManifest
}

func (authorizer RouteAuthorizer) Authorize(route string, channelID string, userID string) (RealtimeMailChannel, error) {
	for _, channel := range authorizer.Manifest.Channels {
		if channelID != "" && channel.ID != channelID {
			continue
		}
		if routeMatches(channel.Route, route, userID) {
			return channel, nil
		}
	}
	return RealtimeMailChannel{}, errors.New("route_not_allowed")
}

type ActionReceiver struct {
	Domain string
}

func (receiver ActionReceiver) Receive(action RealtimeMailAction) (RealtimeMailAction, error) {
	if issues := (ActionValidator{}).Validate(action); len(issues) > 0 {
		return action, errors.New("invalid_action")
	}
	if action.Domain != receiver.Domain {
		return action, errors.New("domain_not_allowed")
	}
	return action, nil
}

func routeMatches(pattern string, route string, userID string) bool {
	patternParts := splitRoute(pattern)
	routeParts := splitRoute(route)
	if len(patternParts) != len(routeParts) {
		return false
	}
	for index, patternPart := range patternParts {
		routePart := routeParts[index]
		if patternPart == ":userId" {
			if userID == "" || routePart != userID {
				return false
			}
		} else if strings.HasPrefix(patternPart, ":") {
			return false
		} else if patternPart != routePart {
			return false
		}
	}
	return true
}

func splitRoute(route string) []string {
	parts := strings.Split(route, "/")
	filtered := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			filtered = append(filtered, part)
		}
	}
	return filtered
}

func isPaymentRequest(payload any) bool {
	value, ok := payload.(map[string]any)
	if !ok {
		return false
	}
	return value["kind"] == "host-mediated-payment-request"
}
