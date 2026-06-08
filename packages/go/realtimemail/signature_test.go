package realtimemail

import (
	"crypto/ed25519"
	"encoding/base64"
	"testing"
	"time"
)

func TestEd25519SignatureVerification(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}

	message := RealtimeMailMessage{
		ID:           "crypto-vector-001",
		Source:       Realtime,
		Domain:       "billing.acme.tld",
		ChannelID:    "invoice-events",
		From:         "billing@acme.tld",
		Subject:      "Signed message",
		HTML:         "<article><h1>Signed</h1></article>",
		CSS:          "body { font-family: sans-serif; }",
		Capabilities: []TrustCapability{RenderHTML, RenderCSS},
		ReceivedAt:   time.Date(2026, 6, 8, 8, 0, 0, 0, time.UTC),
	}

	verifier := SignatureVerifier{}
	canonical, err := verifier.CanonicalMessage(message)
	if err != nil {
		t.Fatal(err)
	}
	signature := ed25519.Sign(privateKey, []byte(canonical))
	message.Signature = "rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0." + base64.RawURLEncoding.EncodeToString(signature)
	publicKeyValue := "ed25519:" + base64.RawURLEncoding.EncodeToString(publicKey)

	if !verifier.VerifyEd25519(message, publicKeyValue) {
		t.Fatal("expected signature to verify")
	}

	message.Subject = "Tampered"
	if verifier.VerifyEd25519(message, publicKeyValue) {
		t.Fatal("expected tampered message to fail")
	}
}
