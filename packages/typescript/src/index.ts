export type TrustCapability =
  | "render:html"
  | "render:css"
  | "render:svg"
  | "run:script-sandboxed"
  | "open-url:user-gesture"
  | "payment-request:user-gesture"
  | "storage:isolated"
  | "network:domain-only";

export type MailSource = "traditional" | "realtime";
export type TrustedDomainState = "trusted" | "muted" | "revoked";
export type MessageLifecycleState = "visible" | "dismissed" | "deleted" | "superseded" | "expired";

export interface RealtimeMailChannel {
  id: string;
  label: string;
  route: string;
  description?: string;
  capabilities: TrustCapability[];
}

export interface RealtimeMailManifest {
  protocol: "realtime-mail";
  version: string;
  domain: string;
  displayName: string;
  publicKeys: string[];
  channels: RealtimeMailChannel[];
}

export interface RealtimeMailMessage {
  id: string;
  source: MailSource;
  domain: string;
  channelId?: string;
  from: string;
  subject: string;
  html: string;
  css?: string;
  script?: string;
  capabilities: TrustCapability[];
  receivedAt: Date;
  expiresAt?: Date;
  signature?: string;
}

export type RealtimeMailActionType =
  | "open_url"
  | "publish_gateway_event"
  | "request_notification"
  | "store_isolated_value";

export interface RealtimeMailAction {
  id: string;
  messageId: string;
  domain: string;
  type: RealtimeMailActionType;
  requiresUserGesture: true;
  url?: string;
  payload?: unknown;
}

export interface HostMediatedPaymentRequest {
  kind: "host-mediated-payment-request";
  invoiceId: string;
  merchant: {
    domain: string;
    displayName: string;
  };
  amount: {
    value: string;
    currency: string;
  };
  description: string;
  orderReference?: string;
  confirmationUx: "browser_payment_request" | "host_confirmation" | "provider_checkout" | "qr_code";
  fallbackProvider?: {
    type: "provider_checkout" | "qr_code";
    label: string;
    url?: string;
    qrPayload?: string;
  };
  expiresAt: string | Date;
}

export interface SignedPayload {
  header: string;
  signature: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "ValidationError";
  }
}

export interface TraditionalMailAccount {
  id: string;
  email: string;
  provider: string;
  incomingHost: string;
  outgoingHost: string;
}

export interface GatewayTransport {
  subscribe(route: string, onMessage: (message: RealtimeMailMessage) => void): Promise<Subscription>;
  publish(route: string, payload: unknown): Promise<void>;
}

export interface DomainStateSnapshot {
  trustedDomains?: Iterable<string>;
  mutedDomains?: Iterable<string>;
  revokedDomains?: Iterable<string>;
}

export interface MessageStateSnapshot {
  dismissedMessageIds?: Iterable<string>;
  deletedMessageIds?: Iterable<string>;
  supersededMessageIds?: Iterable<string>;
  now?: Date;
}

export interface HostActionContext {
  action: unknown;
  message: RealtimeMailMessage;
  manifest: RealtimeMailManifest;
  userGesture: boolean;
  now?: Date;
}

export interface HostActionDecision {
  ok: boolean;
  reason?: string;
  action?: RealtimeMailAction;
}

export interface PaymentRequestSecurityContext {
  action: RealtimeMailAction;
  message: RealtimeMailMessage;
  manifest: RealtimeMailManifest;
  sourceMatchesSelectedSandbox: boolean;
  expectedInvoiceId?: string;
  expectedAmount?: string;
  expectedCurrency?: string;
  processedInvoiceIds?: Iterable<string>;
  now?: Date;
}

export interface PaymentRequestSecurityDecision {
  ok: boolean;
  reason?: string;
  payload?: HostMediatedPaymentRequest;
}

export interface RouteAuthorizationInput {
  route: string;
  channelId?: string;
  userId?: string;
}

export interface RouteAuthorizationDecision {
  ok: boolean;
  reason?: string;
  channel?: RealtimeMailChannel;
}

export interface GatewayActionDecision {
  ok: boolean;
  reason?: string;
  action?: RealtimeMailAction;
}

export interface Subscription {
  route: string;
  close(): Promise<void>;
}

export class ManifestResolver {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  manifestUrl(domain: string): string {
    return `https://${domain}/.well-known/realtime-mail.json`;
  }

  async resolve(domain: string): Promise<RealtimeMailManifest> {
    const response = await this.fetcher(this.manifestUrl(domain));
    if (!response.ok) {
      throw new Error(`Manifest resolution failed for ${domain}: ${response.status}`);
    }
    return this.validate(await response.json());
  }

  validate(value: unknown): RealtimeMailManifest {
    return ManifestValidator.parse(value);
  }
}

export class ManifestValidator {
  static parse(value: unknown): RealtimeMailManifest {
    const issues = this.validate(value);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    return value as RealtimeMailManifest;
  }

  static validate(value: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!isRecord(value)) {
      return [{ path: "$", message: "must be an object" }];
    }
    expectKnownProperties(value, "$", manifestProperties, issues);

    expectEqual(value.protocol, "realtime-mail", "$.protocol", issues);
    expectString(value.version, "$.version", issues);
    expectDomain(value.domain, "$.domain", issues);
    expectString(value.displayName, "$.displayName", issues);
    expectStringArray(value.publicKeys, "$.publicKeys", issues, isPublicKey);

    if (!Array.isArray(value.channels) || value.channels.length === 0) {
      issues.push({ path: "$.channels", message: "must be a non-empty array" });
    } else {
      value.channels.forEach((channel, index) => validateChannel(channel, `$.channels[${index}]`, issues));
    }

    return issues;
  }
}

export class MessageValidator {
  static parse(value: unknown): RealtimeMailMessage {
    const issues = this.validate(value);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    const message = value as Partial<RealtimeMailMessage> & { receivedAt: string | Date };
    return {
      id: message.id!,
      source: message.source!,
      domain: message.domain!,
      channelId: message.channelId,
      from: message.from!,
      subject: message.subject!,
      html: message.html!,
      css: message.css,
      script: message.script,
      capabilities: message.capabilities!,
      receivedAt: new Date(message.receivedAt),
      expiresAt: message.expiresAt === undefined ? undefined : new Date(message.expiresAt),
      signature: message.signature
    };
  }

  static validate(value: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!isRecord(value)) {
      return [{ path: "$", message: "must be an object" }];
    }
    expectKnownProperties(value, "$", messageProperties, issues);

    expectString(value.id, "$.id", issues);
    if (value.source !== "traditional" && value.source !== "realtime") {
      issues.push({ path: "$.source", message: "must be traditional or realtime" });
    }
    expectDomain(value.domain, "$.domain", issues);
    expectString(value.from, "$.from", issues);
    expectString(value.subject, "$.subject", issues, true);
    expectString(value.html, "$.html", issues);
    expectCapabilities(value.capabilities, "$.capabilities", issues);
    expectDate(value.receivedAt, "$.receivedAt", issues);
    if (value.expiresAt !== undefined) {
      expectDate(value.expiresAt, "$.expiresAt", issues);
    }

    if (value.channelId !== undefined) {
      expectChannelId(value.channelId, "$.channelId", issues);
    }
    if (value.css !== undefined) {
      expectString(value.css, "$.css", issues, true);
    }
    if (value.script !== undefined) {
      expectString(value.script, "$.script", issues);
    }
    if (value.signature !== undefined) {
      expectString(value.signature, "$.signature", issues);
    }

    if (value.source === "realtime") {
      if (typeof value.channelId !== "string") {
        issues.push({ path: "$.channelId", message: "is required for realtime messages" });
      }
      if (typeof value.signature !== "string") {
        issues.push({ path: "$.signature", message: "is required for realtime messages" });
      }
    }

    if (typeof value.script === "string" && Array.isArray(value.capabilities) && !value.capabilities.includes("run:script-sandboxed")) {
      issues.push({ path: "$.capabilities", message: "must include run:script-sandboxed when script is present" });
    }

    return issues;
  }
}

export class ActionValidator {
  static parse(value: unknown): RealtimeMailAction {
    const issues = this.validate(value);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    return value as RealtimeMailAction;
  }

  static validate(value: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!isRecord(value)) {
      return [{ path: "$", message: "must be an object" }];
    }
    expectKnownProperties(value, "$", actionProperties, issues);

    expectChannelId(value.id, "$.id", issues);
    expectString(value.messageId, "$.messageId", issues);
    expectDomain(value.domain, "$.domain", issues);
    if (!actionTypes.includes(value.type as RealtimeMailActionType)) {
      issues.push({ path: "$.type", message: "must be a supported action type" });
    }
    if (value.requiresUserGesture !== true) {
      issues.push({ path: "$.requiresUserGesture", message: "must be true" });
    }
    if (value.type === "open_url") {
      if (typeof value.url !== "string" || !isSafeHttpsUrlForDomain(value.url, String(value.domain))) {
        issues.push({ path: "$.url", message: "must be an https URL for the action domain" });
      }
    }
    if (isRecord(value.payload) && value.payload.kind === "host-mediated-payment-request") {
      issues.push(...PaymentRequestPayloadValidator.validate(value.payload).map((issue) => ({
        path: `$.payload${issue.path.slice(1)}`,
        message: issue.message
      })));
      if (value.type !== "publish_gateway_event") {
        issues.push({ path: "$.type", message: "must be publish_gateway_event for payment requests" });
      }
      if (isRecord(value.payload.merchant) && value.payload.merchant.domain !== value.domain) {
        issues.push({ path: "$.payload.merchant.domain", message: "must match action domain" });
      }
    }
    return issues;
  }
}

export class PaymentRequestPayloadValidator {
  static parse(value: unknown): HostMediatedPaymentRequest {
    const issues = this.validate(value);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    return value as HostMediatedPaymentRequest;
  }

  static validate(value: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!isRecord(value)) {
      return [{ path: "$", message: "must be an object" }];
    }
    expectKnownProperties(value, "$", paymentRequestProperties, issues);
    expectEqual(value.kind, "host-mediated-payment-request", "$.kind", issues);
    expectString(value.invoiceId, "$.invoiceId", issues);
    validateMerchant(value.merchant, "$.merchant", issues);
    validatePaymentAmount(value.amount, "$.amount", issues);
    expectString(value.description, "$.description", issues);
    if (value.orderReference !== undefined) {
      expectString(value.orderReference, "$.orderReference", issues);
    }
    if (!paymentConfirmationUx.includes(value.confirmationUx as HostMediatedPaymentRequest["confirmationUx"])) {
      issues.push({ path: "$.confirmationUx", message: "must be a supported confirmation UX" });
    }
    if (value.fallbackProvider !== undefined) {
      validatePaymentFallbackProvider(value.fallbackProvider, "$.fallbackProvider", issues);
    }
    if (isRecord(value.merchant) && isRecord(value.fallbackProvider)) {
      validateFallbackDomain(value.fallbackProvider, String(value.merchant.domain), "$.fallbackProvider", issues);
    }
    expectDate(value.expiresAt, "$.expiresAt", issues);
    return issues;
  }
}

export class PaymentRequestSecurityPolicy {
  static authorize(context: PaymentRequestSecurityContext): PaymentRequestSecurityDecision {
    if (!context.sourceMatchesSelectedSandbox) {
      return { ok: false, reason: "untrusted_frame_source" };
    }
    if (context.action.type !== "publish_gateway_event" || !isRecord(context.action.payload)) {
      return { ok: false, reason: "payment_payload_required" };
    }
    const issues = PaymentRequestPayloadValidator.validate(context.action.payload);
    if (issues.length > 0) {
      return { ok: false, reason: "invalid_payment_payload" };
    }
    const payload = PaymentRequestPayloadValidator.parse(context.action.payload);
    if (context.action.messageId !== context.message.id) {
      return { ok: false, reason: "message_mismatch" };
    }
    if (context.action.domain !== context.message.domain || context.action.domain !== context.manifest.domain) {
      return { ok: false, reason: "domain_mismatch" };
    }
    if (payload.merchant.domain !== context.message.domain) {
      return { ok: false, reason: "merchant_domain_mismatch" };
    }
    if (!context.message.capabilities.includes("payment-request:user-gesture")) {
      return { ok: false, reason: "capability_required" };
    }
    if (context.expectedInvoiceId !== undefined && payload.invoiceId !== context.expectedInvoiceId) {
      return { ok: false, reason: "invoice_mismatch" };
    }
    if (context.expectedAmount !== undefined && payload.amount.value !== context.expectedAmount) {
      return { ok: false, reason: "amount_mismatch" };
    }
    if (context.expectedCurrency !== undefined && payload.amount.currency !== context.expectedCurrency) {
      return { ok: false, reason: "currency_mismatch" };
    }
    if (new Date(payload.expiresAt).getTime() <= (context.now ?? new Date()).getTime()) {
      return { ok: false, reason: "payment_expired" };
    }
    if (contains(context.processedInvoiceIds, payload.invoiceId)) {
      return { ok: false, reason: "duplicate_invoice" };
    }
    return { ok: true, payload };
  }
}

export class SignatureVerifier {
  constructor(private readonly crypto: Crypto = globalThis.crypto) {}

  canonicalMessage(message: RealtimeMailMessage): string {
    const { signature: _signature, ...unsigned } = message;
    return stableStringify(dropUndefined({
      ...unsigned,
      receivedAt: message.receivedAt instanceof Date ? message.receivedAt.toISOString() : message.receivedAt,
      expiresAt: message.expiresAt instanceof Date ? message.expiresAt.toISOString() : message.expiresAt
    }));
  }

  parseSignedPayload(signature: string): SignedPayload {
    const parts = signature.split(".");
    if (parts.length !== 3 || parts[0] !== "rmail1") {
      throw new Error("Unsupported signature format");
    }
    return {
      header: parts[1],
      signature: parts[2]
    };
  }

  async signEd25519(message: RealtimeMailMessage, privateKey: CryptoKey): Promise<string> {
    const header = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "Ed25519", typ: "rmail1" })));
    const signature = await this.crypto.subtle.sign(
      { name: "Ed25519" },
      privateKey,
      new TextEncoder().encode(this.canonicalMessage(message))
    );
    return `rmail1.${header}.${encodeBase64Url(new Uint8Array(signature))}`;
  }

  async verifyEd25519(message: RealtimeMailMessage, publicKey: string): Promise<boolean> {
    if (!message.signature) {
      return false;
    }
    const keyBytes = decodeKey(publicKey, "ed25519");
    const signature = decodeBase64Url(message.signature.startsWith("rmail1.")
      ? this.parseSignedPayload(message.signature).signature
      : message.signature.replace(/^ed25519:/, ""));
    const key = await this.crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "Ed25519" }, false, ["verify"]);
    return this.crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      toArrayBuffer(signature),
      new TextEncoder().encode(this.canonicalMessage(message))
    );
  }
}

export class TrustPolicy {
  private readonly trustedDomains = new Set<string>();

  trustDomain(domain: string): void {
    this.trustedDomains.add(domain);
  }

  revokeDomain(domain: string): void {
    this.trustedDomains.delete(domain);
  }

  isTrusted(domain: string): boolean {
    return this.trustedDomains.has(domain);
  }

  canRender(message: RealtimeMailMessage): boolean {
    if (message.source === "traditional") {
      return message.capabilities.includes("render:html");
    }
    return this.isTrusted(message.domain) && message.capabilities.includes("render:html");
  }

  canRunScript(message: RealtimeMailMessage): boolean {
    return message.source === "realtime"
      && this.isTrusted(message.domain)
      && message.capabilities.includes("run:script-sandboxed");
  }
}

export class StatePolicy {
  static evaluateDomainState(domain: string, snapshot: DomainStateSnapshot): TrustedDomainState {
    if (contains(snapshot.revokedDomains, domain)) {
      return "revoked";
    }
    if (contains(snapshot.mutedDomains, domain)) {
      return "muted";
    }
    return contains(snapshot.trustedDomains, domain) ? "trusted" : "revoked";
  }

  static evaluateMessageState(message: RealtimeMailMessage, snapshot: MessageStateSnapshot = {}): MessageLifecycleState {
    if (contains(snapshot.deletedMessageIds, message.id)) {
      return "deleted";
    }
    if (contains(snapshot.supersededMessageIds, message.id)) {
      return "superseded";
    }
    if (isExpiredMessage(message, snapshot.now ?? new Date())) {
      return "expired";
    }
    if (contains(snapshot.dismissedMessageIds, message.id)) {
      return "dismissed";
    }
    return "visible";
  }

  static shouldDisplay(message: RealtimeMailMessage, domainSnapshot: DomainStateSnapshot, messageSnapshot: MessageStateSnapshot = {}): boolean {
    return this.evaluateDomainState(message.domain, domainSnapshot) === "trusted"
      && this.evaluateMessageState(message, messageSnapshot) === "visible";
  }
}

export class HostActionBroker {
  constructor(
    private readonly trustPolicy: TrustPolicy,
    private readonly verifier: SignatureVerifier = new SignatureVerifier()
  ) {}

  async authorize(context: HostActionContext): Promise<HostActionDecision> {
    const actionIssues = ActionValidator.validate(context.action);
    if (actionIssues.length > 0) {
      return { ok: false, reason: "invalid_action" };
    }
    const action = ActionValidator.parse(context.action);
    if (action.messageId !== context.message.id) {
      return { ok: false, reason: "message_mismatch" };
    }
    if (action.domain !== context.message.domain || action.domain !== context.manifest.domain) {
      return { ok: false, reason: "domain_mismatch" };
    }
    if (!this.trustPolicy.isTrusted(action.domain)) {
      return { ok: false, reason: "domain_not_trusted" };
    }
    if (!context.userGesture || !action.requiresUserGesture) {
      return { ok: false, reason: "user_gesture_required" };
    }
    if (isExpiredMessage(context.message, context.now ?? new Date())) {
      return { ok: false, reason: "message_expired" };
    }
    if (!await this.verifyWithManifestKey(context.message, context.manifest)) {
      return { ok: false, reason: "signature_required" };
    }
    if (!hasActionCapability(context.message, action)) {
      return { ok: false, reason: "capability_required" };
    }
    return { ok: true, action };
  }

  private async verifyWithManifestKey(message: RealtimeMailMessage, manifest: RealtimeMailManifest): Promise<boolean> {
    for (const publicKey of manifest.publicKeys) {
      if (publicKey.startsWith("ed25519:") && await this.verifier.verifyEd25519(message, publicKey)) {
        return true;
      }
    }
    return false;
  }
}

export class SandboxRenderer {
  constructor(private readonly trustPolicy: TrustPolicy) {}

  createIframe(message: RealtimeMailMessage): HTMLIFrameElement {
    const iframe = document.createElement("iframe");
    iframe.sandbox.add(...(this.trustPolicy.canRunScript(message) ? ["allow-scripts"] : []));
    iframe.srcdoc = this.createDocument(message);
    return iframe;
  }

  createDocument(message: RealtimeMailMessage): string {
    if (!this.trustPolicy.canRender(message)) {
      return `<p>Blocked untrusted message from ${escapeHtml(message.domain)}</p>`;
    }
    const script = this.trustPolicy.canRunScript(message) && message.script ? `<script>${message.script}<\/script>` : "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>${message.css ?? ""}</style></head><body>${message.html}${script}</body></html>`;
  }
}

export class RealtimeMessageBuilder {
  constructor(
    private readonly manifest: RealtimeMailManifest,
    private readonly clock: () => Date = () => new Date()
  ) {}

  build(input: {
    id?: string;
    channelId: string;
    from: string;
    subject: string;
    html: string;
    css?: string;
    script?: string;
    capabilities?: TrustCapability[];
    receivedAt?: Date;
    expiresAt?: Date;
  }): RealtimeMailMessage {
    const channel = this.manifest.channels.find((candidate) => candidate.id === input.channelId);
    if (!channel) {
      throw new Error(`Unknown channel: ${input.channelId}`);
    }
    const message: RealtimeMailMessage = {
      id: input.id ?? crypto.randomUUID(),
      source: "realtime",
      domain: this.manifest.domain,
      channelId: channel.id,
      from: input.from,
      subject: input.subject,
      html: input.html,
      css: input.css,
      script: input.script,
      capabilities: input.capabilities ?? channel.capabilities,
      receivedAt: input.receivedAt ?? this.clock(),
      expiresAt: input.expiresAt
    };
    const issues = MessageValidator.validate({ ...message, signature: "unsigned-builder-placeholder" });
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    return message;
  }
}

export class MessageSigner {
  constructor(private readonly verifier: SignatureVerifier = new SignatureVerifier()) {}

  async signEd25519(message: RealtimeMailMessage, privateKey: CryptoKey): Promise<RealtimeMailMessage> {
    const unsigned = { ...message, signature: undefined };
    return {
      ...unsigned,
      signature: await this.verifier.signEd25519(unsigned, privateKey)
    };
  }
}

export class RouteAuthorizer {
  constructor(private readonly manifest: RealtimeMailManifest) {}

  authorize(input: RouteAuthorizationInput): RouteAuthorizationDecision {
    const channel = this.manifest.channels.find((candidate) => {
      if (input.channelId && candidate.id !== input.channelId) {
        return false;
      }
      return matchRoute(candidate.route, input.route, input.userId);
    });
    if (!channel) {
      return { ok: false, reason: "route_not_allowed" };
    }
    return { ok: true, channel };
  }
}

export class ActionReceiver {
  constructor(private readonly domain: string) {}

  receive(value: unknown): GatewayActionDecision {
    const issues = ActionValidator.validate(value);
    if (issues.length > 0) {
      return { ok: false, reason: "invalid_action" };
    }
    const action = ActionValidator.parse(value);
    if (action.domain !== this.domain) {
      return { ok: false, reason: "domain_not_allowed" };
    }
    if (!action.requiresUserGesture) {
      return { ok: false, reason: "user_gesture_required" };
    }
    return { ok: true, action };
  }
}

export class RealtimeGatewayClient {
  constructor(private readonly transport: GatewayTransport) {}

  subscribe(channel: RealtimeMailChannel, onMessage: (message: RealtimeMailMessage) => void): Promise<Subscription> {
    return this.transport.subscribe(channel.route, onMessage);
  }

  publishAction(route: string, payload: unknown): Promise<void> {
    return this.transport.publish(route, payload);
  }
}

export class EventSourceGatewayTransport implements GatewayTransport {
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

  async subscribe(route: string, onMessage: (message: RealtimeMailMessage) => void): Promise<Subscription> {
    const url = new URL("/events", this.baseUrl);
    url.searchParams.set("route", route);
    const source = new EventSource(url);
    source.addEventListener("message", (event) => {
      onMessage(MessageValidator.parse(JSON.parse(event.data)));
    });
    return {
      route,
      close: async () => source.close()
    };
  }

  async publish(route: string, payload: unknown): Promise<void> {
    const response = await this.fetcher(new URL("/actions", this.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ route, ...asRecord(payload) })
    });
    if (!response.ok) {
      throw new Error(`Gateway publish failed: ${response.status}`);
    }
  }
}

export class TraditionalMailAccountManager {
  private readonly accounts = new Map<string, TraditionalMailAccount>();

  addAccount(account: TraditionalMailAccount): void {
    this.accounts.set(account.id, account);
  }

  removeAccount(accountId: string): void {
    this.accounts.delete(accountId);
  }

  listAccounts(): TraditionalMailAccount[] {
    return [...this.accounts.values()];
  }
}

export class RealtimeMailClient {
  constructor(
    readonly manifests: ManifestResolver,
    readonly trust: TrustPolicy,
    readonly gateway: RealtimeGatewayClient,
    readonly accounts: TraditionalMailAccountManager
  ) {}

  async discover(domain: string): Promise<RealtimeMailManifest> {
    return this.manifests.resolve(domain);
  }

  trustDomain(domain: string): void {
    this.trust.trustDomain(domain);
  }

  subscribe(channel: RealtimeMailChannel, onMessage: (message: RealtimeMailMessage) => void): Promise<Subscription> {
    return this.gateway.subscribe(channel, onMessage);
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const channelIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const publicKeyPattern = /^(ed25519|ecdsa-p256):[A-Za-z0-9_-]+={0,2}$/;
const capabilities: readonly TrustCapability[] = [
  "render:html",
  "render:css",
  "render:svg",
  "run:script-sandboxed",
  "open-url:user-gesture",
  "payment-request:user-gesture",
  "storage:isolated",
  "network:domain-only"
];
const actionTypes: readonly RealtimeMailActionType[] = [
  "open_url",
  "publish_gateway_event",
  "request_notification",
  "store_isolated_value"
];
const manifestProperties = new Set(["protocol", "version", "domain", "displayName", "publicKeys", "channels"]);
const channelProperties = new Set(["id", "label", "route", "description", "capabilities"]);
const messageProperties = new Set([
  "id",
  "source",
  "domain",
  "channelId",
  "from",
  "subject",
  "html",
  "css",
  "script",
  "capabilities",
  "receivedAt",
  "expiresAt",
  "signature"
]);
const actionProperties = new Set(["id", "messageId", "domain", "type", "requiresUserGesture", "url", "payload"]);
const paymentRequestProperties = new Set([
  "kind",
  "invoiceId",
  "merchant",
  "amount",
  "description",
  "orderReference",
  "confirmationUx",
  "fallbackProvider",
  "expiresAt"
]);
const merchantProperties = new Set(["domain", "displayName"]);
const paymentAmountProperties = new Set(["value", "currency"]);
const paymentFallbackProviderProperties = new Set(["type", "label", "url", "qrPayload"]);
const paymentConfirmationUx: readonly HostMediatedPaymentRequest["confirmationUx"][] = [
  "browser_payment_request",
  "host_confirmation",
  "provider_checkout",
  "qr_code"
];
const paymentFallbackProviderTypes = ["provider_checkout", "qr_code"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { payload: value };
}

function expectEqual(value: unknown, expected: unknown, path: string, issues: ValidationIssue[]): void {
  if (value !== expected) {
    issues.push({ path, message: `must equal ${String(expected)}` });
  }
}

function expectString(value: unknown, path: string, issues: ValidationIssue[], allowEmpty = false): void {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    issues.push({ path, message: "must be a string" });
  }
}

function expectDomain(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !domainPattern.test(value)) {
    issues.push({ path, message: "must be a valid domain" });
  }
}

function expectChannelId(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !channelIdPattern.test(value)) {
    issues.push({ path, message: "must be a valid channel id" });
  }
}

function expectDate(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!((typeof value === "string" || value instanceof Date) && !Number.isNaN(new Date(value).getTime()))) {
    issues.push({ path, message: "must be a valid date-time" });
  }
}

function validateMerchant(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  expectKnownProperties(value, path, merchantProperties, issues);
  expectDomain(value.domain, `${path}.domain`, issues);
  expectString(value.displayName, `${path}.displayName`, issues);
}

function validatePaymentAmount(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  expectKnownProperties(value, path, paymentAmountProperties, issues);
  if (typeof value.value !== "string" || !/^(0|[1-9][0-9]{0,11})(\.[0-9]{2})$/.test(value.value)) {
    issues.push({ path: `${path}.value`, message: "must be a decimal amount string with two fractional digits" });
  }
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) {
    issues.push({ path: `${path}.currency`, message: "must be an ISO 4217 currency code" });
  }
}

function validatePaymentFallbackProvider(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  expectKnownProperties(value, path, paymentFallbackProviderProperties, issues);
  if (!paymentFallbackProviderTypes.includes(value.type as typeof paymentFallbackProviderTypes[number])) {
    issues.push({ path: `${path}.type`, message: "must be a supported fallback provider type" });
  }
  expectString(value.label, `${path}.label`, issues);
  if (value.type === "provider_checkout") {
    if (typeof value.url !== "string" || !isSafeHttpsUrl(value.url)) {
      issues.push({ path: `${path}.url`, message: "must be an https URL" });
    }
  }
  if (value.type === "qr_code") {
    expectString(value.qrPayload, `${path}.qrPayload`, issues);
  }
}

function validateFallbackDomain(value: Record<string, unknown>, merchantDomain: string, path: string, issues: ValidationIssue[]): void {
  if (value.type !== "qr_code") {
    return;
  }
  const target = value.qrPayload;
  if (typeof target !== "string") {
    return;
  }
  try {
    const url = new URL(target);
    if (url.protocol === "https:" && url.hostname !== merchantDomain) {
      issues.push({ path: `${path}.qrPayload`, message: "must target the merchant domain" });
    }
  } catch {
    return;
  }
}

function expectStringArray(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  predicate: (item: string) => boolean = () => true
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: "must be a non-empty string array" });
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string" || !predicate(item)) {
      issues.push({ path: `${path}[${index}]`, message: "must be a valid string value" });
    }
  });
}

function expectCapabilities(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "must be an array" });
    return;
  }
  value.forEach((item, index) => {
    if (!capabilities.includes(item as TrustCapability)) {
      issues.push({ path: `${path}[${index}]`, message: "must be a supported capability" });
    }
  });
}

function isPublicKey(value: string): boolean {
  return publicKeyPattern.test(value);
}

function validateChannel(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  expectKnownProperties(value, path, channelProperties, issues);

  expectChannelId(value.id, `${path}.id`, issues);
  expectString(value.label, `${path}.label`, issues);
  expectString(value.route, `${path}.route`, issues);
  expectCapabilities(value.capabilities, `${path}.capabilities`, issues);
  if (value.description !== undefined) {
    expectString(value.description, `${path}.description`, issues, true);
  }
}

function expectKnownProperties(
  value: Record<string, unknown>,
  path: string,
  allowed: ReadonlySet<string>,
  issues: ValidationIssue[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({ path: `${path}.${key}`, message: "is not a supported property" });
    }
  }
}

function isSafeHttpsUrlForDomain(value: string, domain: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === domain;
  } catch {
    return false;
  }
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasActionCapability(message: RealtimeMailMessage, action: RealtimeMailAction): boolean {
  if (action.type === "open_url") {
    return message.capabilities.includes("open-url:user-gesture");
  }
  if (action.type === "publish_gateway_event"
    && isRecord(action.payload)
    && action.payload.kind === "host-mediated-payment-request") {
    return message.capabilities.includes("payment-request:user-gesture");
  }
  return true;
}

function isExpiredMessage(message: RealtimeMailMessage, now: Date): boolean {
  return Boolean(message.expiresAt && message.expiresAt.getTime() <= now.getTime());
}

function contains(values: Iterable<string> | undefined, needle: string): boolean {
  if (!values) {
    return false;
  }
  for (const value of values) {
    if (value === needle) {
      return true;
    }
  }
  return false;
}

function matchRoute(pattern: string, route: string, userId?: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean);
  const routeParts = route.split("/").filter(Boolean);
  if (patternParts.length !== routeParts.length) {
    return false;
  }
  return patternParts.every((part, index) => {
    if (part === ":userId") {
      return Boolean(userId) && routeParts[index] === userId;
    }
    return part.startsWith(":") || part === routeParts[index];
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function dropUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}

function decodeKey(value: string, prefix: string): Uint8Array {
  if (!value.startsWith(`${prefix}:`)) {
    throw new Error(`Expected ${prefix} public key`);
  }
  return decodeBase64Url(value.slice(prefix.length + 1));
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}
