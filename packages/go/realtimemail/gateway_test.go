package realtimemail

import (
	"crypto/ed25519"
	"encoding/base64"
	"testing"
	"time"
)

func TestGatewayProfileSecurity(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	manifest := RealtimeMailManifest{
		Protocol:    "realtime-mail",
		Version:     "0.1-draft",
		Domain:      "billing.acme.tld",
		DisplayName: "ACME Billing",
		PublicKeys:  []string{"ed25519:" + base64.RawURLEncoding.EncodeToString(publicKey)},
		Channels: []RealtimeMailChannel{{
			ID:           "invoice-events",
			Label:        "Invoices",
			Route:        "/rt/invoices/:userId",
			Capabilities: []TrustCapability{RenderHTML, RenderCSS, OpenURLUserGesture},
		}},
	}
	builder := RealtimeMessageBuilder{
		Manifest: manifest,
		Clock:    func() time.Time { return time.Date(2026, 6, 8, 8, 0, 0, 0, time.UTC) },
	}
	message, err := builder.Build(RealtimeMessageInput{
		ID:        "host-action-001",
		ChannelID: "invoice-events",
		From:      "billing@acme.tld",
		Subject:   "Action test",
		HTML:      "<a>Open</a>",
		ExpiresAt: time.Date(2026, 6, 8, 8, 15, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal(err)
	}
	message, err = (MessageSigner{}).SignEd25519(message, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	action := RealtimeMailAction{
		ID:                  "open-invoice",
		MessageID:           message.ID,
		Domain:              message.Domain,
		Type:                OpenURL,
		RequiresUserGesture: true,
		URL:                 "https://billing.acme.tld/invoices/1",
	}
	trust := NewTrustPolicy()
	trust.TrustDomain("billing.acme.tld")
	broker := HostActionBroker{TrustPolicy: trust, Verifier: SignatureVerifier{}}
	if _, err := broker.Authorize(action, message, manifest, true, time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC)); err != nil {
		t.Fatalf("valid host action rejected: %v", err)
	}
	if _, err := broker.Authorize(action, message, manifest, false, time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC)); err == nil {
		t.Fatal("missing user gesture accepted")
	}
	if _, err := broker.Authorize(action, message, manifest, true, time.Date(2026, 6, 8, 8, 16, 0, 0, time.UTC)); err == nil {
		t.Fatal("expired message accepted")
	}
	if _, err := (RouteAuthorizer{Manifest: manifest}).Authorize("/rt/invoices/demo-user", "invoice-events", "demo-user"); err != nil {
		t.Fatalf("valid route rejected: %v", err)
	}
	if _, err := (RouteAuthorizer{Manifest: manifest}).Authorize("/rt/admin/demo-user", "invoice-events", "demo-user"); err == nil {
		t.Fatal("invalid route accepted")
	}
	unsafePlaceholderManifest := manifest
	unsafePlaceholderManifest.Channels = []RealtimeMailChannel{{
		ID:           "invoice-events",
		Label:        "Invoices",
		Route:        "/rt/invoices/:accountId",
		Capabilities: []TrustCapability{RenderHTML},
	}}
	if _, err := (RouteAuthorizer{Manifest: unsafePlaceholderManifest}).Authorize("/rt/invoices/other-user", "invoice-events", "demo-user"); err == nil {
		t.Fatal("unbound route placeholder accepted")
	}
	if _, err := (ActionReceiver{Domain: "billing.acme.tld"}).Receive(action); err != nil {
		t.Fatalf("valid gateway action rejected: %v", err)
	}
	if _, err := (ActionReceiver{Domain: "billing.acme.tld"}).Receive(RealtimeMailAction{
		ID:                  "open-invoice",
		MessageID:           message.ID,
		Domain:              "evil.example",
		Type:                OpenURL,
		RequiresUserGesture: true,
		URL:                 "https://evil.example/invoices/1",
	}); err == nil {
		t.Fatal("cross-domain gateway action accepted")
	}
	paymentMessage, err := builder.Build(RealtimeMessageInput{
		ID:        "invoice-payment-001",
		ChannelID: "invoice-events",
		From:      "billing@acme.tld",
		Subject:   "Invoice payment",
		HTML:      "<button>Pay</button>",
		Capabilities: []TrustCapability{
			RenderHTML,
			RenderCSS,
			RunScriptSandboxed,
			PaymentRequestUserGesture,
		},
		ExpiresAt: time.Date(2026, 6, 8, 8, 15, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal(err)
	}
	paymentMessage, err = (MessageSigner{}).SignEd25519(paymentMessage, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	paymentPayload := map[string]any{
		"kind":        "host-mediated-payment-request",
		"invoiceId":   "2026-0608",
		"merchant":    map[string]any{"domain": "billing.acme.tld", "displayName": "ACME Billing"},
		"amount":      map[string]any{"value": "184.90", "currency": "EUR"},
		"description": "Invoice #2026-0608",
		"confirmationUx": "qr_code",
		"fallbackProvider": map[string]any{
			"type":      "qr_code",
			"label":     "Scan to pay",
			"qrPayload": "https://billing.acme.tld/pay/invoices/2026-0608",
		},
		"expiresAt": "2026-06-08T08:15:00Z",
	}
	paymentAction := RealtimeMailAction{
		ID:                  "pay-invoice",
		MessageID:           paymentMessage.ID,
		Domain:              paymentMessage.Domain,
		Type:                PublishGatewayEvent,
		RequiresUserGesture: true,
		Payload:             paymentPayload,
	}
	authorizedPayment, err := broker.Authorize(paymentAction, paymentMessage, manifest, true, time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("valid payment host action rejected: %v", err)
	}
	paymentDecision := (PaymentRequestSecurityPolicy{}).Authorize(PaymentRequestSecurityContext{
		Action:                       authorizedPayment,
		Message:                      paymentMessage,
		Manifest:                     manifest,
		SourceMatchesSelectedSandbox: true,
		ExpectedInvoiceID:            "2026-0608",
		ExpectedAmount:               "184.90",
		ExpectedCurrency:             "EUR",
		Now:                          time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC),
	})
	if !paymentDecision.OK {
		t.Fatalf("valid payment rejected: %s", paymentDecision.Reason)
	}
	if decision := (PaymentRequestSecurityPolicy{}).Authorize(PaymentRequestSecurityContext{Action: authorizedPayment, Message: paymentMessage, Manifest: manifest, Now: time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC)}); decision.Reason != "untrusted_frame_source" {
		t.Fatalf("wrong iframe source reason: %s", decision.Reason)
	}
	if decision := (PaymentRequestSecurityPolicy{}).Authorize(PaymentRequestSecurityContext{Action: authorizedPayment, Message: paymentMessage, Manifest: manifest, SourceMatchesSelectedSandbox: true, ExpectedAmount: "999.99", Now: time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC)}); decision.Reason != "amount_mismatch" {
		t.Fatalf("wrong amount mismatch reason: %s", decision.Reason)
	}
	if decision := (PaymentRequestSecurityPolicy{}).Authorize(PaymentRequestSecurityContext{Action: authorizedPayment, Message: paymentMessage, Manifest: manifest, SourceMatchesSelectedSandbox: true, ProcessedInvoiceIDs: []string{"2026-0608"}, Now: time.Date(2026, 6, 8, 8, 1, 0, 0, time.UTC)}); decision.Reason != "duplicate_invoice" {
		t.Fatalf("wrong duplicate invoice reason: %s", decision.Reason)
	}
	externalQrPayload := map[string]any{}
	for key, value := range paymentPayload {
		externalQrPayload[key] = value
	}
	externalQrPayload["fallbackProvider"] = map[string]any{"type": "qr_code", "label": "Scan to pay", "qrPayload": "https://evil.example/pay"}
	if len((PaymentRequestPayloadValidator{}).Validate(externalQrPayload)) == 0 {
		t.Fatal("external QR payload accepted")
	}
	policy := StatePolicy{}
	if policy.EvaluateDomainState("billing.acme.tld", DomainStateSnapshot{TrustedDomains: map[string]bool{"billing.acme.tld": true}}) != TrustedDomain {
		t.Fatal("trusted domain state rejected")
	}
	if policy.EvaluateDomainState("billing.acme.tld", DomainStateSnapshot{
		TrustedDomains: map[string]bool{"billing.acme.tld": true},
		MutedDomains:   map[string]bool{"billing.acme.tld": true},
	}) != MutedDomain {
		t.Fatal("muted domain state rejected")
	}
	if policy.EvaluateDomainState("billing.acme.tld", DomainStateSnapshot{
		TrustedDomains: map[string]bool{"billing.acme.tld": true},
		RevokedDomains: map[string]bool{"billing.acme.tld": true},
	}) != RevokedDomain {
		t.Fatal("revoked domain state rejected")
	}
	if policy.EvaluateMessageState(message, MessageStateSnapshot{Now: time.Date(2026, 6, 8, 8, 16, 0, 0, time.UTC)}) != ExpiredMessage {
		t.Fatal("expired message state rejected")
	}
	if policy.EvaluateMessageState(message, MessageStateSnapshot{
		DeletedMessageIDs:   map[string]bool{message.ID: true},
		DismissedMessageIDs: map[string]bool{message.ID: true},
		Now:                 time.Date(2026, 6, 8, 8, 16, 0, 0, time.UTC),
	}) != DeletedMessage {
		t.Fatal("deleted message state precedence rejected")
	}
}
