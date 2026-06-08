# Java SDK Reference

Package namespace: `org.realtimemail`

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

### `ValidationException`

- `issues(): List<ValidationIssue>`

### `ManifestValidator`

- `validate(RealtimeMailManifest manifest): List<ValidationIssue>`
- `parse(RealtimeMailManifest manifest): RealtimeMailManifest`

### `MessageValidator`

- `validate(RealtimeMailMessage message): List<ValidationIssue>`
- `parse(RealtimeMailMessage message): RealtimeMailMessage`

### `ActionValidator`

- `validate(RealtimeMailAction action): List<ValidationIssue>`
- `parse(RealtimeMailAction action): RealtimeMailAction`

### `PaymentRequestPayloadValidator`

- `validate(Map<String, Object> payload): List<ValidationIssue>`

### `SignatureVerifier`

- `verifyEd25519(RealtimeMailMessage message, String publicKey): boolean`
- `canonicalMessage(RealtimeMailMessage message): String`

Repository check:

```bash
npm.cmd run java:check
```

### `ManifestResolver`

- `manifestUri(String domain): URI`
- `resolveJson(String domain): CompletableFuture<String>`

### `TrustPolicy`

- `trustDomain(String domain): void`
- `revokeDomain(String domain): void`
- `isTrusted(String domain): boolean`
- `canRender(RealtimeMailMessage message): boolean`
- `canRunScript(RealtimeMailMessage message): boolean`

### `StatePolicy`

- `evaluateDomainState(String domain, DomainStateSnapshot snapshot): TrustedDomainState`
- `evaluateMessageState(RealtimeMailMessage message, MessageStateSnapshot snapshot): MessageLifecycleState`
- `shouldDisplay(RealtimeMailMessage message, DomainStateSnapshot domainSnapshot, MessageStateSnapshot messageSnapshot): boolean`

### `PaymentRequestSecurityPolicy`

- `authorize(...): PaymentRequestSecurityDecision`

Checks the host-mediated payment payload against the source message, manifest domain, iframe source, payment capability, expected invoice, amount, currency, expiry, and processed invoice ids.

### `RealtimeGatewayClient`

- `subscribe(RealtimeMailChannel channel, Consumer<RealtimeMailMessage> onMessage): CompletableFuture<Subscription>`
- `publishAction(String route, Object payload): CompletableFuture<Void>`

### Gateway Profile

- `HostActionBroker.authorize(...)`
- `RealtimeMessageBuilder.build(...)`
- `MessageSigner.signEd25519(...)`
- `RouteAuthorizer.authorize(...)`
- `ActionReceiver.receive(...)`

### `TraditionalMailAccountManager`

- `addAccount(TraditionalMailAccount account): void`
- `removeAccount(String accountId): void`
- `listAccounts(): List<TraditionalMailAccount>`

### `RealtimeMailClient`

- `discover(String domain): CompletableFuture<String>`
- `trustDomain(String domain): void`
- `subscribe(RealtimeMailChannel channel, Consumer<RealtimeMailMessage> onMessage): CompletableFuture<Subscription>`
- `accounts(): TraditionalMailAccountManager`
