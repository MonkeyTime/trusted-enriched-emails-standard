# Python SDK Reference

Package: `realtime-mail`

## Models

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

## Validators

### `ManifestValidator`

- `validate(value) -> list[ValidationIssue]`
- `parse(value) -> RealtimeMailManifest`

### `MessageValidator`

- `validate(value) -> list[ValidationIssue]`
- `parse(value) -> RealtimeMailMessage`

### `ActionValidator`

- `validate(value) -> list[ValidationIssue]`
- `parse(value) -> RealtimeMailAction`

### `ValidationError`

- `issues: list[ValidationIssue]`

## Security

### `TrustPolicy`

- `trust_domain(domain: str) -> None`
- `revoke_domain(domain: str) -> None`
- `is_trusted(domain: str) -> bool`
- `can_render(message: RealtimeMailMessage) -> bool`
- `can_run_script(message: RealtimeMailMessage) -> bool`

### `StatePolicy`

- `evaluate_domain_state(domain, snapshot) -> TrustedDomainState`
- `evaluate_message_state(message, snapshot) -> MessageLifecycleState`
- `should_display(message, domain_snapshot, message_snapshot) -> bool`

### `SignatureVerifier`

- `canonical_message(message: RealtimeMailMessage) -> str`
- `verify_ed25519(message: RealtimeMailMessage, public_key: str) -> bool`

`verify_ed25519` uses the optional `cryptography` extra. If the dependency is not installed, it fails closed and returns `False`.

## Gateway Profile

- `HostActionBroker.authorize(...)`
- `RealtimeMessageBuilder.build(...)`
- `MessageSigner.sign_ed25519(...)`
- `RouteAuthorizer.authorize(...)`
- `ActionReceiver.receive(...)`
