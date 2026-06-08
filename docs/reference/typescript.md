# TypeScript SDK Reference

Package: `@realtimemail/sdk`

## Types

- `TrustCapability`: capability strings such as `render:html` and `run:script-sandboxed`.
- `MailSource`: `traditional` or `realtime`.
- `TrustedDomainState`: `trusted`, `muted`, or `revoked`.
- `MessageLifecycleState`: `visible`, `dismissed`, `deleted`, `superseded`, or `expired`.
- `SignedPayload`: parsed `rmail1` signature parts.
- `ValidationIssue`: validation issue with `path` and `message`.
- `RealtimeMailAction`: host-mediated action request.
- `RealtimeMailActionType`: action type union.
- `HostMediatedPaymentRequest`: standard payment request payload.
- `RealtimeMailChannel`: manifest channel declaration.
- `RealtimeMailManifest`: `.well-known` manifest shape.
- `RealtimeMailMessage`: unified message model.
- `TraditionalMailAccount`: traditional mail account metadata.
- `GatewayTransport`: transport interface implemented by WebSocket/SSE adapters.
- `Subscription`: active gateway subscription.

## Classes

### `ValidationError`

- `issues: ValidationIssue[]`

### `ManifestValidator`

- `parse(value: unknown): RealtimeMailManifest`
- `validate(value: unknown): ValidationIssue[]`

### `MessageValidator`

- `parse(value: unknown): RealtimeMailMessage`
- `validate(value: unknown): ValidationIssue[]`

### `ActionValidator`

- `parse(value: unknown): RealtimeMailAction`
- `validate(value: unknown): ValidationIssue[]`

### `PaymentRequestPayloadValidator`

- `parse(value: unknown): HostMediatedPaymentRequest`
- `validate(value: unknown): ValidationIssue[]`

### `PaymentRequestSecurityPolicy`

- `authorize(context): PaymentRequestSecurityDecision`

Checks the host-mediated payment payload against the source message, manifest domain, iframe source, payment capability, expected invoice, amount, currency, expiry, and processed invoice ids.

### `HostActionBroker`

- `authorize(context): Promise<HostActionDecision>`

Checks host-mediated actions against the source message, manifest domain, local trust policy, user gesture, expiry, signature, and required capability.

### `SignatureVerifier`

- `canonicalMessage(message: RealtimeMailMessage): string`
- `parseSignedPayload(signature: string): SignedPayload`
- `signEd25519(message: RealtimeMailMessage, privateKey: CryptoKey): Promise<string>`
- `verifyEd25519(message: RealtimeMailMessage, publicKey: string): Promise<boolean>`

### `ManifestResolver`

- `manifestUrl(domain: string): string`
- `resolve(domain: string): Promise<RealtimeMailManifest>`
- `validate(value: unknown): RealtimeMailManifest`

### `TrustPolicy`

- `trustDomain(domain: string): void`
- `revokeDomain(domain: string): void`
- `isTrusted(domain: string): boolean`
- `canRender(message: RealtimeMailMessage): boolean`
- `canRunScript(message: RealtimeMailMessage): boolean`

### `StatePolicy`

- `evaluateDomainState(domain, snapshot): TrustedDomainState`
- `evaluateMessageState(message, snapshot): MessageLifecycleState`
- `shouldDisplay(message, domainSnapshot, messageSnapshot): boolean`

### `SandboxRenderer`

- `createIframe(message: RealtimeMailMessage): HTMLIFrameElement`
- `createDocument(message: RealtimeMailMessage): string`

### `RealtimeGatewayClient`

- `subscribe(channel, onMessage): Promise<Subscription>`
- `publishAction(route, payload): Promise<void>`

### `RealtimeMessageBuilder`

- `build(input): RealtimeMailMessage`

Creates unsigned enriched realtime messages for a manifest channel.

### `MessageSigner`

- `signEd25519(message, privateKey): Promise<RealtimeMailMessage>`

### `RouteAuthorizer`

- `authorize(input): RouteAuthorizationDecision`

### `ActionReceiver`

- `receive(value: unknown): GatewayActionDecision`

### `TraditionalMailAccountManager`

- `addAccount(account): void`
- `removeAccount(accountId): void`
- `listAccounts(): TraditionalMailAccount[]`

### `RealtimeMailClient`

- `discover(domain): Promise<RealtimeMailManifest>`
- `trustDomain(domain): void`
- `subscribe(channel, onMessage): Promise<Subscription>`
