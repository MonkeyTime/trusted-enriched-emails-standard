# C# SDK Reference

Namespace: `RealtimeMail`

## Records and Enums

- `TrustCapability`
- `MailSource`
- `TrustedDomainState`
- `MessageLifecycleState`
- `ValidationIssue`
- `RealtimeMailChannel`
- `RealtimeMailManifest`
- `RealtimeMailMessage`
- `RealtimeMailAction`
- `RealtimeMailActionType`
- `TraditionalMailAccount`

## Classes

### `RealtimeMailValidationException`

- `Issues: IReadOnlyList<ValidationIssue>`

### `ManifestValidator`

- `Validate(RealtimeMailManifest manifest): IReadOnlyList<ValidationIssue>`
- `Parse(RealtimeMailManifest manifest): RealtimeMailManifest`

### `MessageValidator`

- `Validate(RealtimeMailMessage message): IReadOnlyList<ValidationIssue>`
- `Parse(RealtimeMailMessage message): RealtimeMailMessage`

### `ActionValidator`

- `Validate(RealtimeMailAction action): IReadOnlyList<ValidationIssue>`
- `Parse(RealtimeMailAction action): RealtimeMailAction`

### `SignatureVerifier`

- `VerifyEd25519(RealtimeMailMessage message, string publicKey): bool`
- `VerifyEcdsaP256(RealtimeMailMessage message, string publicKey): bool`
- `CanonicalMessage(RealtimeMailMessage message): string`

Note: `VerifyEd25519` fails closed in the current package because there is no built-in Ed25519 API wired here. Use `VerifyEcdsaP256` or add a vetted Ed25519 provider before production use.

Repository check:

```bash
npm.cmd run csharp:conformance
```

### `ManifestResolver`

- `ManifestUri(string domain): Uri`
- `ResolveJsonAsync(string domain, CancellationToken cancellationToken = default): Task<string>`

### `TrustPolicy`

- `TrustDomain(string domain): void`
- `RevokeDomain(string domain): void`
- `IsTrusted(string domain): bool`
- `CanRender(RealtimeMailMessage message): bool`
- `CanRunScript(RealtimeMailMessage message): bool`

### `StatePolicy`

- `EvaluateDomainState(string domain, DomainStateSnapshot snapshot): TrustedDomainState`
- `EvaluateMessageState(RealtimeMailMessage message, MessageStateSnapshot snapshot): MessageLifecycleState`
- `ShouldDisplay(RealtimeMailMessage message, DomainStateSnapshot domainSnapshot, MessageStateSnapshot messageSnapshot): bool`

### `RealtimeGatewayClient`

- `SubscribeAsync(RealtimeMailChannel channel, Action<RealtimeMailMessage> onMessage, CancellationToken cancellationToken = default): Task<ISubscription>`
- `PublishActionAsync(string route, object payload, CancellationToken cancellationToken = default): Task`

### Gateway Profile

- `HostActionBroker.Authorize(...)`
- `RealtimeMessageBuilder.Build(...)`
- `MessageSigner.SignEcdsaP256(...)`
- `RouteAuthorizer.Authorize(...)`
- `ActionReceiver.Receive(...)`

### `TraditionalMailAccountManager`

- `AddAccount(TraditionalMailAccount account): void`
- `RemoveAccount(string accountId): void`
- `ListAccounts(): IReadOnlyList<TraditionalMailAccount>`

### `RealtimeMailClient`

- `DiscoverAsync(string domain, CancellationToken cancellationToken = default): Task<string>`
- `TrustDomain(string domain): void`
- `SubscribeAsync(RealtimeMailChannel channel, Action<RealtimeMailMessage> onMessage, CancellationToken cancellationToken = default): Task<ISubscription>`
