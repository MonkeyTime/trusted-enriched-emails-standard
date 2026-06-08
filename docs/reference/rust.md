# Rust SDK Reference

Crate: `realtime-mail`

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
- `ValidationIssue`
- `ValidationError`

## Validators

### `ManifestValidator`

- `validate(manifest: &RealtimeMailManifest) -> Vec<ValidationIssue>`
- `parse(manifest: RealtimeMailManifest) -> Result<RealtimeMailManifest, ValidationError>`

### `MessageValidator`

- `validate(message: &RealtimeMailMessage) -> Vec<ValidationIssue>`
- `parse(message: RealtimeMailMessage) -> Result<RealtimeMailMessage, ValidationError>`

### `ActionValidator`

- `validate(action: &RealtimeMailAction) -> Vec<ValidationIssue>`
- `parse(action: RealtimeMailAction) -> Result<RealtimeMailAction, ValidationError>`

### `PaymentRequestPayloadValidator`

- `validate(payload: &serde_json::Value) -> Vec<ValidationIssue>`

## Security

### `SignatureVerifier`

- `canonical_message(message: &RealtimeMailMessage) -> Result<String, serde_json::Error>`
- `verify_ed25519(message: &RealtimeMailMessage, public_key: &str) -> bool`

### `TrustPolicy`

- `trust_domain(domain: &str)`
- `revoke_domain(domain: &str)`
- `is_trusted(domain: &str) -> bool`

### `StatePolicy`

- `evaluate_domain_state(domain: &str, snapshot: &DomainStateSnapshot) -> TrustedDomainState`
- `evaluate_message_state(message: &RealtimeMailMessage, snapshot: &MessageStateSnapshot) -> MessageLifecycleState`
- `should_display(message, domain_snapshot, message_snapshot) -> bool`

### `PaymentRequestSecurityPolicy`

- `authorize(context: PaymentRequestSecurityContext) -> PaymentRequestSecurityDecision`

Checks the host-mediated payment payload against the source message, manifest domain, iframe source, payment capability, expected invoice, amount, currency, expiry, and processed invoice ids.

## Gateway Profile

- `HostActionBroker::authorize(...)`
- `RealtimeMessageBuilder::build(...)`
- `MessageSigner::sign_ed25519(...)`
- `RouteAuthorizer::authorize(...)`
- `ActionReceiver::receive(...)`

The Rust SDK is intended to become the future shared security core and WebAssembly candidate.

Repository check:

```bash
npm.cmd run rust:check
```
