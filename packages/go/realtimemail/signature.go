package realtimemail

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"strings"
)

type SignatureVerifier struct{}

func (SignatureVerifier) CanonicalMessage(message RealtimeMailMessage) (string, error) {
	value := map[string]any{
		"capabilities": message.Capabilities,
		"domain":       message.Domain,
		"from":         message.From,
		"html":         message.HTML,
		"id":           message.ID,
		"receivedAt":   message.ReceivedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		"source":       message.Source,
		"subject":      message.Subject,
	}
	if message.ChannelID != "" {
		value["channelId"] = message.ChannelID
	}
	if message.CSS != "" {
		value["css"] = message.CSS
	}
	if message.Script != "" {
		value["script"] = message.Script
	}
	if !message.ExpiresAt.IsZero() {
		value["expiresAt"] = message.ExpiresAt.UTC().Format("2006-01-02T15:04:05.000Z")
	}
	bytes, err := json.Marshal(value)
	return string(bytes), err
}

func (verifier SignatureVerifier) VerifyEd25519(message RealtimeMailMessage, publicKey string) bool {
	if message.Signature == "" || !strings.HasPrefix(publicKey, "ed25519:") {
		return false
	}
	key, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(publicKey, "ed25519:"))
	if err != nil || len(key) != ed25519.PublicKeySize {
		return false
	}
	signature, err := signatureBytes(message.Signature)
	if err != nil {
		return false
	}
	canonical, err := verifier.CanonicalMessage(message)
	if err != nil {
		return false
	}
	return ed25519.Verify(ed25519.PublicKey(key), []byte(canonical), signature)
}

func signatureBytes(signature string) ([]byte, error) {
	value := strings.TrimPrefix(signature, "ed25519:")
	if strings.HasPrefix(signature, "rmail1.") {
		parts := strings.Split(signature, ".")
		if len(parts) != 3 {
			return nil, base64.CorruptInputError(0)
		}
		value = parts[2]
	}
	return base64.RawURLEncoding.DecodeString(value)
}
