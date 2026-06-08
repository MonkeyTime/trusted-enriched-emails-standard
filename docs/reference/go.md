# Go SDK Reference

Module: `github.com/realtimemail/realtime-mail-go`

## Types

- `TrustCapability`
- `MailSource`
- `TrustedDomainState`
- `MessageLifecycleState`
- `RealtimeMailChannel`
- `RealtimeMailManifest`
- `RealtimeMailMessage`
- `RealtimeMailAction`
- `RealtimeMailActionType`
- `TraditionalMailAccount`
- `ValidationIssue`
- `ValidationError`

## Validators

### `ManifestValidator`

- `Validate(manifest RealtimeMailManifest) []ValidationIssue`
- `Parse(manifest RealtimeMailManifest) (RealtimeMailManifest, error)`

### `MessageValidator`

- `Validate(message RealtimeMailMessage) []ValidationIssue`
- `Parse(message RealtimeMailMessage) (RealtimeMailMessage, error)`

### `ActionValidator`

- `Validate(action RealtimeMailAction) []ValidationIssue`
- `Parse(action RealtimeMailAction) (RealtimeMailAction, error)`

### `PaymentRequestPayloadValidator`

- `Validate(payload map[string]any) []ValidationIssue`

## Security

### `TrustPolicy`

- `NewTrustPolicy() *TrustPolicy`
- `TrustDomain(domain string)`
- `RevokeDomain(domain string)`
- `IsTrusted(domain string) bool`
- `CanRender(message RealtimeMailMessage) bool`
- `CanRunScript(message RealtimeMailMessage) bool`

### `StatePolicy`

- `EvaluateDomainState(domain string, snapshot DomainStateSnapshot) TrustedDomainState`
- `EvaluateMessageState(message RealtimeMailMessage, snapshot MessageStateSnapshot) MessageLifecycleState`
- `ShouldDisplay(message RealtimeMailMessage, domainSnapshot DomainStateSnapshot, messageSnapshot MessageStateSnapshot) bool`

### `SignatureVerifier`

- `CanonicalMessage(message RealtimeMailMessage) (string, error)`
- `VerifyEd25519(message RealtimeMailMessage, publicKey string) bool`

The Go SDK uses only the standard library, including `crypto/ed25519`.

### `PaymentRequestSecurityPolicy`

- `Authorize(context PaymentRequestSecurityContext) PaymentRequestSecurityDecision`

Checks the host-mediated payment payload against the source message, manifest domain, iframe source, payment capability, expected invoice, amount, currency, expiry, and processed invoice ids.

## Gateway Profile

- `HostActionBroker.Authorize(...)`
- `RealtimeMessageBuilder.Build(...)`
- `MessageSigner.SignEd25519(...)`
- `RouteAuthorizer.Authorize(...)`
- `ActionReceiver.Receive(...)`

Repository check:

```bash
npm.cmd run go:check
```
