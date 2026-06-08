import {
  createBrokerMessageContent,
  createManifests,
  createSeedMessages,
  createTraditionalAccounts,
  t
} from "./i18n";
import { ClientStateStore, channelKey } from "./client-state-store";
import {
  HostActionBroker,
  ManifestValidator,
  MessageValidator,
  PaymentRequestPayloadValidator,
  PaymentRequestSecurityPolicy,
  StatePolicy,
  SignatureVerifier,
  TrustPolicy,
  type RealtimeMailManifest,
  type RealtimeMailMessage,
  type HostMediatedPaymentRequest,
  type TrustCapability
} from "@realtimemail/sdk";
import "./styles.css";

type TrustLevel = "html" | "interactive";
type MessageSource = "traditional" | "realtime";

type TraditionalMailAccount = {
  id: string;
  email: string;
  provider: string;
  incoming: string;
  outgoing: string;
  status: "connected" | "needs-auth";
};

type TrustManifest = {
  domain: string;
  displayName: string;
  verifiedBy: string;
  permissions: TrustLevel[];
  channels: Channel[];
};

type Channel = {
  id: string;
  label: string;
  route: string;
  description: string;
};

type MailMessage = {
  id: string;
  source: MessageSource;
  domain: string;
  channelId: string;
  subject: string;
  from: string;
  receivedAt: Date;
  html: string;
  css: string;
  js?: string;
  requires: TrustLevel;
  capabilities: TrustCapability[];
  expiresAt?: Date;
  signedMessage?: RealtimeMailMessage;
  signatureStatus?: "verified" | "rejected" | "unverified";
};

type HostActionRequest = {
  action: string;
  payment?: HostMediatedPaymentRequest;
};

type ThemeMode = "day" | "night";

type LayoutState = {
  theme: ThemeMode;
  sidebarCompact: boolean;
  sidebarWidth: number;
  inboxWidth: number;
  auditWidth: number;
};

const manifests = createManifests() as TrustManifest[];
const traditionalAccounts = createTraditionalAccounts() as TraditionalMailAccount[];
const seedMessages: MailMessage[] = (createSeedMessages() as MailMessage[]).map((message) => ({
  ...message,
  capabilities: trustLevelToCapabilities(message.requires),
  signatureStatus: message.source === "realtime" ? "unverified" as const : undefined
}));
const gatewayBaseUrl = "http://127.0.0.1:8787";
const gatewayRoute = "/rt/invoices/demo-user";
const signatureVerifier = new SignatureVerifier();
const stateStore = new ClientStateStore(globalThis.localStorage);
const processedPaymentInvoiceIds = new Set<string>();
const layoutState = loadLayoutState();
let lastSandboxPointerAt = 0;
let gatewayEvents: EventSource | undefined;

const state = {
  messages: [...seedMessages],
  selectedMessageId: "m-001",
  gatewayStatus: "disconnected" as "disconnected" | "connecting" | "connected",
  gatewayManifest: undefined as RealtimeMailManifest | undefined,
  eventLog: [
    t("eventClientStarted"),
    t("eventManifestsLoaded"),
    t("eventRealtimeSubscriptionBilling"),
    t("eventRealtimeSubscriptionStatus")
  ]
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

const root = app;

window.addEventListener("message", (event) => {
  if (event.data?.type === "trusted-mail-action") {
    void handleSandboxAction(event.data, event.source, hasFreshSandboxUserGesture());
  }
});

applyTheme();

async function handleSandboxAction(actionValue: unknown, source: MessageEventSource | null, userGesture: boolean) {
  const message = state.messages.find((item) => item.id === state.selectedMessageId);
  const request = parseHostActionRequest(actionValue);
  if (!isSelectedSandboxSource(source)) {
    state.eventLog.unshift(t("eventSandboxActionRejected", { action: request.action }));
    render();
    return;
  }
  if (message && await canAcceptHostAction(message, request, userGesture)) {
    state.eventLog.unshift(t("eventSandboxActionAccepted", { action: request.action }));
    lastSandboxPointerAt = 0;
    if (request.action === "pay_invoice") {
      if (request.payment) {
        processedPaymentInvoiceIds.add(request.payment.invoiceId);
      }
      await runHostPaymentFlow(message, request);
    }
  } else {
    state.eventLog.unshift(t("eventSandboxActionRejected", { action: request.action }));
  }
  render();
}

function getManifest(domain: string) {
  if (state.gatewayManifest?.domain === domain) {
    return {
      domain: state.gatewayManifest.domain,
      displayName: state.gatewayManifest.displayName,
      verifiedBy: t("gatewayVerified"),
      permissions: standardCapabilitiesToTrustLevels(state.gatewayManifest.channels.flatMap((channel) => channel.capabilities)),
      channels: state.gatewayManifest.channels.map((channel) => ({
        id: channel.id,
        label: channel.label,
        route: channel.route,
        description: channel.description ?? ""
      }))
    } satisfies TrustManifest;
  }
  return manifests.find((manifest) => manifest.domain === domain);
}

function keyFor(domain: string, channelId: string) {
  return channelKey(domain, channelId);
}

function isChannelSubscribed(message: MailMessage) {
  if (message.source === "traditional") {
    return true;
  }
  if (StatePolicy.evaluateDomainState(message.domain, stateStore.domainSnapshot()) === "revoked") {
    return false;
  }
  return stateStore.isSubscribed(message.domain, message.channelId);
}

function isDeleted(message: MailMessage) {
  return StatePolicy.evaluateMessageState(toPolicyMessage(message), stateStore.messageSnapshot()) === "deleted";
}

function isExpired(message: MailMessage) {
  return StatePolicy.evaluateMessageState(toPolicyMessage(message), stateStore.messageSnapshot()) === "expired";
}

function canRender(message: MailMessage) {
  if (message.source === "traditional") {
    return message.requires === "html";
  }
  if (message.signatureStatus === "rejected") {
    return false;
  }
  if (!StatePolicy.shouldDisplay(toPolicyMessage(message), stateStore.domainSnapshot(), stateStore.messageSnapshot())) {
    return false;
  }
  const manifest = getManifest(message.domain);
  if (!manifest) {
    return false;
  }
  return manifest.permissions.includes(message.requires);
}

function canRunScripts(message: MailMessage) {
  if (message.source === "traditional") {
    return false;
  }
  if (isExpired(message)) {
    return false;
  }
  if (message.signatureStatus !== undefined && message.signatureStatus !== "verified") {
    return false;
  }
  const manifest = getManifest(message.domain);
  return Boolean(message.js
    && manifest?.permissions.includes("interactive")
    && StatePolicy.evaluateDomainState(message.domain, stateStore.domainSnapshot()) === "trusted");
}

async function canAcceptHostAction(message: MailMessage, request: HostActionRequest, userGesture: boolean) {
  const manifest = state.gatewayManifest?.domain === message.domain ? state.gatewayManifest : undefined;
  if (!manifest || !message.signedMessage || !userGesture) {
    return false;
  }
  const trustPolicy = new TrustPolicy();
  if (StatePolicy.evaluateDomainState(message.domain, stateStore.domainSnapshot()) === "trusted") {
    trustPolicy.trustDomain(message.domain);
  }
  const broker = new HostActionBroker(trustPolicy, signatureVerifier);
  const hostAction = {
    id: request.action,
    messageId: message.id,
    domain: message.domain,
    type: request.action === "pay_invoice" ? "publish_gateway_event" as const : "open_url" as const,
    requiresUserGesture: true as const,
    url: request.action === "pay_invoice" ? undefined : `https://${message.domain}/`,
    payload: request.action === "pay_invoice" ? request.payment : undefined
  };
  const decision = await broker.authorize({
    action: hostAction,
    message: message.signedMessage,
    manifest,
    userGesture,
    now: new Date()
  });
  if (!decision.ok || !stateStore.isSubscribed(message.domain, message.channelId)) {
    return false;
  }
  if (request.action !== "pay_invoice") {
    return isAllowedHostActionRequest(message, request);
  }
  return PaymentRequestSecurityPolicy.authorize({
    action: hostAction,
    message: message.signedMessage,
    manifest,
    sourceMatchesSelectedSandbox: true,
    expectedInvoiceId: "2026-0608",
    expectedAmount: "184.90",
    expectedCurrency: "EUR",
    processedInvoiceIds: processedPaymentInvoiceIds,
    now: new Date()
  }).ok;
}

async function connectGateway() {
  if (state.gatewayStatus === "connected" || state.gatewayStatus === "connecting") {
    return;
  }
  state.gatewayStatus = "connecting";
  state.eventLog.unshift(t("gatewayStatus") + ": " + t("gatewayConnecting"));
  render();

  try {
    const manifestResponse = await fetch(`${gatewayBaseUrl}/.well-known/realtime-mail.json`);
    state.gatewayManifest = ManifestValidator.parse(await manifestResponse.json());
    stateStore.trustDomain(state.gatewayManifest.domain);
    stateStore.subscribe(state.gatewayManifest.domain, "invoice-events");
    mergeGatewayManifest(state.gatewayManifest);
    state.eventLog.unshift(t("gatewayManifestLoaded", { domain: state.gatewayManifest.domain }));

    gatewayEvents?.close();
    const eventsUrl = new URL("/events", gatewayBaseUrl);
    eventsUrl.searchParams.set("route", gatewayRoute);
    gatewayEvents = new EventSource(eventsUrl);
    gatewayEvents.addEventListener("ready", () => {
      state.gatewayStatus = "connected";
      state.eventLog.unshift(t("gatewayConnectedEvent", { route: gatewayRoute }));
      render();
    });
    gatewayEvents.addEventListener("message", (event) => {
      void receiveGatewayMessage(JSON.parse(event.data));
    });
    gatewayEvents.addEventListener("error", () => {
      state.gatewayStatus = "disconnected";
      state.eventLog.unshift(t("gatewayError", { error: "sse" }));
      render();
    });
  } catch (error) {
    state.gatewayStatus = "disconnected";
    state.eventLog.unshift(t("gatewayError", { error: error instanceof Error ? error.message : "unknown" }));
    render();
  }
}

async function receiveGatewayMessage(payload: unknown) {
  const message = MessageValidator.parse(payload);
  const key = state.gatewayManifest?.publicKeys.find((publicKey) => publicKey.startsWith("ed25519:"));
  const verified = Boolean(state.gatewayManifest
    && message.domain === state.gatewayManifest.domain
    && key
    && await signatureVerifier.verifyEd25519(message, key));
  const localMessage = mapGatewayMessage(message, verified);
  if (!StatePolicy.shouldDisplay(toPolicyMessage(localMessage), stateStore.domainSnapshot(), stateStore.messageSnapshot())) {
    state.eventLog.unshift(t("gatewayMessageSuppressed", { id: localMessage.id }));
    render();
    return;
  }
  state.messages.unshift(localMessage);
  state.selectedMessageId = localMessage.id;
  state.eventLog.unshift(verified
    ? t("gatewayMessageVerified", { id: localMessage.id })
    : t("gatewayMessageRejected", { id: localMessage.id }));
  render();
}

async function publishGatewayDemo() {
  await publishGatewayMessage("/publish-demo", "gatewayPublishRequested");
}

async function publishGatewayGameDemo() {
  await publishGatewayMessage("/publish-game-demo", "gatewayGamePublishRequested");
}

async function publishGatewayPaymentDemo() {
  await publishGatewayMessage("/publish-payment-demo", "gatewayPaymentPublishRequested");
}

async function publishGatewayMessage(path: string, eventKey: "gatewayPublishRequested" | "gatewayGamePublishRequested" | "gatewayPaymentPublishRequested") {
  try {
    await fetch(`${gatewayBaseUrl}${path}?route=${encodeURIComponent(gatewayRoute)}`, { method: "POST" });
    state.eventLog.unshift(t(eventKey));
  } catch (error) {
    state.eventLog.unshift(t("gatewayError", { error: error instanceof Error ? error.message : "unknown" }));
  }
  render();
}

function mergeGatewayManifest(manifest: RealtimeMailManifest) {
  if (!manifests.some((existing) => existing.domain === manifest.domain)) {
    manifests.unshift({
      domain: manifest.domain,
      displayName: manifest.displayName,
      verifiedBy: t("gatewayVerified"),
      permissions: standardCapabilitiesToTrustLevels(manifest.channels.flatMap((channel) => channel.capabilities)),
      channels: manifest.channels.map((channel) => ({
        id: channel.id,
        label: channel.label,
        route: channel.route,
        description: channel.description ?? ""
      }))
    });
  }
}

function mapGatewayMessage(message: RealtimeMailMessage, verified: boolean): MailMessage {
  return {
    id: message.id,
    source: "realtime",
    domain: message.domain,
    channelId: message.channelId ?? "gateway",
    subject: message.subject,
    from: message.from,
    receivedAt: message.receivedAt,
    html: message.html,
    css: message.css ?? "",
    js: message.script,
    requires: message.capabilities.includes("run:script-sandboxed") ? "interactive" : "html",
    capabilities: message.capabilities,
    expiresAt: message.expiresAt,
    signedMessage: message,
    signatureStatus: verified ? "verified" : "rejected"
  };
}

function standardCapabilitiesToTrustLevels(capabilities: string[]): TrustLevel[] {
  const levels = new Set<TrustLevel>();
  if (capabilities.includes("render:html")) {
    levels.add("html");
  }
  if (capabilities.includes("run:script-sandboxed")) {
    levels.add("interactive");
  }
  return [...levels];
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function sandboxCsp(canRunScript: boolean) {
  const scriptSrc = canRunScript ? "'unsafe-inline'" : "'none'";
  return `default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src ${scriptSrc}; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; media-src data: blob:`;
}

function messageDocument(message: MailMessage) {
  const canRunMessageScripts = canRunScripts(message);
  if (!canRender(message)) {
    return `
      <!doctype html>
      <html><body style="margin:0;font-family:Inter,system-ui,sans-serif;background:#fff8f5;color:#2b1d18;padding:24px">
        <p style="margin:0 0 10px;color:#9a3412;font-weight:800">${t("blockedTitle")}</p>
        <h1 style="margin:0 0 12px;font-size:24px">${escapeHtml(message.subject)}</h1>
        <p>${escapeHtml(t("blockedBody", { domain: message.domain }))}</p>
        <pre style="white-space:pre-wrap;border:1px solid #f0c7b6;border-radius:8px;padding:12px;background:#fff">${escapeHtml(message.html)}</pre>
      </body></html>
    `;
  }

  const script = canRunMessageScripts ? `<script>${message.js}<\/script>` : "";
  const jsNotice = message.js && !canRunMessageScripts
    ? `<p style="font-family:Inter,system-ui,sans-serif;margin:0;padding:10px 14px;background:#fff4cf;color:#5a4200;border-bottom:1px solid #eed98f">${t("scriptRemoved")}</p>`
    : "";
  const csp = sandboxCsp(canRunMessageScripts);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content="${csp}" />
        <style>${message.css}</style>
      </head>
      <body>
        ${jsNotice}
        ${message.html}
        ${script}
      </body>
    </html>
  `;
}

function emitBrokerMessage(domain: string, channelId: string) {
  const count = state.messages.length + 1;
  const requires: TrustLevel = domain === "billing.acme.tld" ? "interactive" : "html";
  const content = createBrokerMessageContent(domain, channelId, count, requires === "interactive");

  state.messages.unshift({
    id: `m-${String(count).padStart(3, "0")}`,
    source: "realtime",
    domain,
    channelId,
    subject: content.subject,
    from: `events@${domain}`,
    receivedAt: new Date(),
    requires,
    html: content.html,
    css: content.css,
    js: content.js,
    capabilities: trustLevelToCapabilities(requires),
    expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    signatureStatus: "unverified"
  });
  state.selectedMessageId = state.messages[0].id;
  state.eventLog.unshift(t("eventBroker", { domain, channel: channelId }));
  render();
}

function render() {
  const selected = state.messages.find((message) => message.id === state.selectedMessageId) ?? state.messages[0];
  const inbox = state.messages.filter((message) => isChannelSubscribed(message) && !isDeleted(message));
  const active = selected && !isDeleted(selected) && isChannelSubscribed(selected) ? selected : inbox[0];

  root.innerHTML = `
    <main class="shell ${layoutState.sidebarCompact ? "sidebar-compact" : ""}" style="${layoutStyle()}">
      <aside class="sidebar">
        <div class="sidebar-inner">
          <div class="brand">
            <div class="mark" title="${t("appTitle")}">RT</div>
            <div class="brand-copy">
              <h1>${t("appTitle")}</h1>
              <p>${t("appSubtitle")}</p>
            </div>
          </div>
          <div class="sidebar-controls">
            <label class="mode-switch" title="${t("themeToggleTitle")}" aria-label="${t("themeToggleTitle")}">
              <span>${t("dayMode")}</span>
              <input type="checkbox" data-action="toggle-theme" ${layoutState.theme === "night" ? "checked" : ""} />
              <i></i>
              <span>${t("nightMode")}</span>
            </label>
            <button class="icon-button" type="button" data-action="toggle-sidebar" title="${t("compactSidebarTitle")}" aria-label="${t("compactSidebarTitle")}">
              ${layoutState.sidebarCompact ? ">" : "<"}
            </button>
          </div>
          <section class="panel">
            <h2>${t("domains")}</h2>
            <div class="domains">
              ${manifests.map((manifest) => domainView(manifest)).join("")}
            </div>
          </section>
          <section class="panel optional-panel">
            <h2>${t("mailAccounts")}</h2>
            <div class="accounts">
              ${traditionalAccounts.map(accountView).join("")}
            </div>
          </section>
          <section class="panel optional-panel">
            <h2>${t("gateway")}</h2>
            <div class="gateway">
              <p><strong>${t("broker")}</strong><span>${t("brokerValue")}</span></p>
              <p><strong>${t("transport")}</strong><span>${t("transportValue")}</span></p>
              <p><strong>${t("isolation")}</strong><span>${t("isolationValue")}</span></p>
              <p><strong>${t("gatewayStatus")}</strong><span>${gatewayStatusLabel()}</span></p>
              <div class="gateway-actions">
                <button data-action="connect-gateway">${t("connectGateway")}</button>
                <button data-action="publish-gateway">${t("publishSigned")}</button>
                <button data-action="publish-game">${t("publishGame")}</button>
                <button data-action="publish-payment">${t("publishPayment")}</button>
              </div>
            </div>
          </section>
        </div>
      </aside>
      <div class="resize-handle" data-resizer="sidebar" role="separator" aria-label="${t("resizeSidebar")}"></div>

      <section class="inbox">
        <header class="topbar">
          <div>
            <h2>${t("inbox")}</h2>
            <p>${inbox.length} ${t("inboxSubtitle")}</p>
          </div>
          <button class="primary" data-action="simulate">${t("simulate")}</button>
        </header>
        <div class="message-list">
          ${inbox.length > 0 ? inbox.map((message) => messageRow(message, active?.id ?? "")).join("") : `<p class="empty">${t("emptyInbox")}</p>`}
        </div>
      </section>
      <div class="resize-handle" data-resizer="inbox" role="separator" aria-label="${t("resizeInbox")}"></div>

      <section class="reader">
        ${active ? readerView(active) : emptyReaderView()}
      </section>
      <div class="resize-handle" data-resizer="audit" role="separator" aria-label="${t("resizeReader")}"></div>

      <aside class="audit">
        <h2>${t("audit")}</h2>
        <div class="audit-list">
          ${state.eventLog.slice(0, 9).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </div>
      </aside>
    </main>
  `;

  bindEvents();
}

function readerView(message: MailMessage) {
  return `
    <header class="reader-head">
      <div>
        <p>${escapeHtml(message.domain)}</p>
        <h2>${escapeHtml(message.subject)}</h2>
      </div>
      <div class="reader-actions">
        <span class="${canRender(message) ? "pill ok" : "pill danger"}">${canRender(message) ? renderLabel(message) : t("blocked")}</span>
        <button data-action="delete-message" data-message="${escapeHtml(message.id)}">${t("deleteMessage")}</button>
      </div>
    </header>
    <iframe title="Message sandbox" data-role="message-sandbox" sandbox="${canRunScripts(message) ? "allow-scripts" : ""}" srcdoc="${escapeHtml(messageDocument(message))}"></iframe>
  `;
}

function emptyReaderView() {
  return `
    <div class="empty-reader">
      <h2>${t("emptyReaderTitle")}</h2>
      <p>${t("emptyReaderBody")}</p>
    </div>
  `;
}

function renderLabel(message: MailMessage) {
  if (message.source === "traditional") {
    return t("emailHtml");
  }
  if (message.signatureStatus === "verified") {
    return t("gatewayVerified");
  }
  if (message.signatureStatus === "rejected") {
    return t("gatewayRejected");
  }
  if (canRunScripts(message)) {
    return t("htmlCssJs");
  }
  return t("htmlCss");
}

function accountView(account: TraditionalMailAccount) {
  return `
    <article class="account ${account.status === "connected" ? "connected" : ""}">
      <div>
        <h3>${escapeHtml(account.email)}</h3>
        <p>${escapeHtml(account.provider)}</p>
      </div>
      <span class="${account.status === "connected" ? "mini ok" : "mini warn"}">${account.status === "connected" ? t("connected") : t("auth")}</span>
      <small>${escapeHtml(account.incoming)} / ${escapeHtml(account.outgoing)}</small>
    </article>
  `;
}

function domainView(manifest: TrustManifest) {
  const domainState = StatePolicy.evaluateDomainState(manifest.domain, stateStore.domainSnapshot());
  const trusted = domainState === "trusted";
  const revoked = domainState === "revoked";
  const muted = domainState === "muted";
  return `
    <article class="domain ${trusted ? "trusted" : ""} ${revoked ? "revoked" : ""} ${muted ? "muted" : ""}">
      <div class="domain-head">
        <div class="domain-icon" title="${escapeHtml(manifest.displayName)}">${escapeHtml(domainIcon(manifest.displayName))}</div>
        <div>
          <h3>${escapeHtml(manifest.displayName)}</h3>
          <p>${escapeHtml(manifest.domain)}</p>
        </div>
        <label class="switch" title="${t("trustedToggleTitle")}">
          <input type="checkbox" data-action="trust" data-domain="${escapeHtml(manifest.domain)}" ${trusted && !revoked ? "checked" : ""} />
          <span></span>
        </label>
      </div>
      <p class="proof">${escapeHtml(manifest.verifiedBy)}</p>
      <div class="channels">
          ${manifest.channels.map((channel) => channelView(manifest, channel)).join("")}
      </div>
      <div class="domain-actions">
        <button type="button" class="domain-remove" data-action="mute-domain" data-domain="${escapeHtml(manifest.domain)}">${muted ? t("domainMuted") : t("muteDomain")}</button>
        <button type="button" class="domain-remove" data-action="remove-domain" data-domain="${escapeHtml(manifest.domain)}">${revoked ? t("domainRemoved") : t("removeDomain")}</button>
      </div>
    </article>
  `;
}

function channelView(manifest: TrustManifest, channel: Channel) {
  const subscribed = stateStore.isSubscribed(manifest.domain, channel.id);
  const disabled = StatePolicy.evaluateDomainState(manifest.domain, stateStore.domainSnapshot()) === "revoked";
  return `
    <label class="channel">
      <input type="checkbox" data-action="subscribe" data-domain="${escapeHtml(manifest.domain)}" data-channel="${escapeHtml(channel.id)}" ${subscribed && !disabled ? "checked" : ""} ${disabled ? "disabled" : ""} />
      <span>
        <strong>${escapeHtml(channel.label)}</strong>
        <small>${escapeHtml(channel.route)}</small>
      </span>
    </label>
  `;
}

function messageRow(message: MailMessage, selectedId: string) {
  return `
    <button class="message ${message.id === selectedId ? "active" : ""}" data-action="select" data-message="${escapeHtml(message.id)}">
      <span class="subject">${escapeHtml(message.subject)}</span>
      <span class="meta">${escapeHtml(message.from)} | ${message.source === "traditional" ? t("mail") : t("realtimeShort")} | ${timeAgo(message.receivedAt)}</span>
      <span class="${canRender(message) ? "state ok" : "state danger"}">${canRender(message) ? renderLabel(message) : t("blocked")}</span>
    </button>
  `;
}

function timeAgo(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) {
    return t("now");
  }
  return `${minutes} ${t("minuteSuffix")}`;
}

function bindEvents() {
  document.querySelectorAll<HTMLElement>("[data-action='select']").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMessageId = button.dataset.message ?? state.selectedMessageId;
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-action='trust']").forEach((input) => {
    input.addEventListener("change", () => {
      const domain = input.dataset.domain;
      if (!domain) return;
      if (input.checked) {
        stateStore.trustDomain(domain);
        state.eventLog.unshift(t("eventDomainTrusted", { domain }));
      } else {
        stateStore.revokeDomain(domain);
        state.eventLog.unshift(t("eventDomainRevoked", { domain }));
      }
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-action='subscribe']").forEach((input) => {
    input.addEventListener("change", () => {
      const domain = input.dataset.domain;
      const channel = input.dataset.channel;
      if (!domain || !channel) return;
      if (input.checked) {
        stateStore.subscribe(domain, channel);
        state.eventLog.unshift(t("eventSubscribed", { domain, channel }));
      } else {
        stateStore.unsubscribe(domain, channel);
        state.eventLog.unshift(t("eventUnsubscribed", { domain, channel }));
      }
      const visible = state.messages.filter(isChannelSubscribed);
      state.selectedMessageId = visible[0]?.id ?? state.selectedMessageId;
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-action='remove-domain']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const domain = button.dataset.domain;
      if (!domain) return;
      revokeDomain(domain);
      render();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-action='mute-domain']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const domain = button.dataset.domain;
      if (!domain) return;
      stateStore.muteDomain(domain);
      state.eventLog.unshift(t("eventDomainMuted", { domain }));
      const visible = state.messages.filter((message) => isChannelSubscribed(message) && !isDeleted(message));
      state.selectedMessageId = visible[0]?.id ?? "";
      render();
    });
  });

  document.querySelector<HTMLElement>("[data-action='delete-message']")?.addEventListener("click", () => {
    const message = state.messages.find((item) => item.id === state.selectedMessageId);
    if (!message) return;
    stateStore.deleteMessage(message.id);
    state.eventLog.unshift(t("eventMessageDeleted", { id: message.id }));
    const visible = state.messages.filter((item) => isChannelSubscribed(item) && !isDeleted(item));
    state.selectedMessageId = visible[0]?.id ?? "";
    render();
  });

  document.querySelector<HTMLElement>("[data-action='simulate']")?.addEventListener("click", () => {
    const subscriptions = stateStore.snapshot().subscribedChannels;
    const first = subscriptions[0];
    if (!first) return;
    const [domain, channelId] = first.split(":");
    emitBrokerMessage(domain, channelId);
  });

  document.querySelector<HTMLElement>("[data-action='connect-gateway']")?.addEventListener("click", () => {
    void connectGateway();
  });

  document.querySelector<HTMLElement>("[data-action='publish-gateway']")?.addEventListener("click", () => {
    void publishGatewayDemo();
  });

  document.querySelector<HTMLElement>("[data-action='publish-game']")?.addEventListener("click", () => {
    void publishGatewayGameDemo();
  });

  document.querySelector<HTMLElement>("[data-action='publish-payment']")?.addEventListener("click", () => {
    void publishGatewayPaymentDemo();
  });

  document.querySelector<HTMLInputElement>("[data-action='toggle-theme']")?.addEventListener("change", (event) => {
    layoutState.theme = (event.currentTarget as HTMLInputElement).checked ? "night" : "day";
    saveLayoutState();
    applyTheme();
  });

  document.querySelector<HTMLElement>("[data-action='toggle-sidebar']")?.addEventListener("click", () => {
    layoutState.sidebarCompact = !layoutState.sidebarCompact;
    saveLayoutState();
    render();
  });

  document.querySelectorAll<HTMLElement>("[data-resizer]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => startResize(event, handle.dataset.resizer));
  });

  document.querySelector<HTMLIFrameElement>("[data-role='message-sandbox']")?.addEventListener("pointerdown", (event) => {
    if (event.isTrusted) {
      lastSandboxPointerAt = Date.now();
    }
  });

  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  const shell = document.querySelector<HTMLElement>(".shell");
  sidebar?.addEventListener("mouseenter", () => shell?.classList.add("sidebar-peek"));
  sidebar?.addEventListener("mouseleave", () => shell?.classList.remove("sidebar-peek"));
  sidebar?.addEventListener("focusin", () => shell?.classList.add("sidebar-peek"));
  sidebar?.addEventListener("focusout", () => shell?.classList.remove("sidebar-peek"));
}

render();

function revokeDomain(domain: string) {
  stateStore.revokeDomain(domain);
  if (state.gatewayManifest?.domain === domain) {
    gatewayEvents?.close();
    gatewayEvents = undefined;
    state.gatewayStatus = "disconnected";
  }
  state.eventLog.unshift(t("eventDomainRemoved", { domain }));
  const visible = state.messages.filter((message) => isChannelSubscribed(message) && !isDeleted(message));
  state.selectedMessageId = visible[0]?.id ?? "";
}

function toPolicyMessage(message: MailMessage): RealtimeMailMessage {
  return message.signedMessage ?? {
    id: message.id,
    source: message.source,
    domain: message.domain,
    channelId: message.channelId,
    from: message.from,
    subject: message.subject,
    html: message.html,
    css: message.css,
    script: message.js,
    capabilities: message.capabilities,
    receivedAt: message.receivedAt,
    expiresAt: message.expiresAt,
    signature: message.signatureStatus === "verified" ? "verified-placeholder" : undefined
  };
}

function trustLevelToCapabilities(level: TrustLevel): TrustCapability[] {
  return level === "interactive"
    ? ["render:html", "render:css", "run:script-sandboxed", "open-url:user-gesture", "payment-request:user-gesture"]
    : ["render:html", "render:css"];
}

function parseHostActionRequest(value: unknown): HostActionRequest {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      action: typeof record.action === "string" ? record.action : "unknown",
      payment: PaymentRequestPayloadValidator.validate(record.payment).length === 0
        ? PaymentRequestPayloadValidator.parse(record.payment)
        : undefined
    };
  }
  return {
    action: typeof value === "string" ? value : "unknown"
  };
}

function isSelectedSandboxSource(source: MessageEventSource | null): boolean {
  const frame = document.querySelector<HTMLIFrameElement>(".reader iframe");
  return Boolean(frame?.contentWindow && source === frame.contentWindow);
}

function hasFreshSandboxUserGesture() {
  return lastSandboxPointerAt > 0 && Date.now() - lastSandboxPointerAt < 3000;
}

function isAllowedHostActionRequest(message: MailMessage, request: HostActionRequest): boolean {
  if (request.action !== "pay_invoice") {
    return request.action === "pay-invoice" || request.action === "open-link";
  }
  if (!request.payment || PaymentRequestPayloadValidator.validate(request.payment).length > 0) {
    return false;
  }
  return message.domain === "billing.acme.tld"
    && message.channelId === "invoice-events"
    && message.capabilities.includes("payment-request:user-gesture")
    && request.payment.invoiceId === "2026-0608"
    && request.payment.merchant.domain === message.domain
    && request.payment.amount.value === "184.90"
    && request.payment.amount.currency === "EUR";
}

async function runHostPaymentFlow(message: MailMessage, request: HostActionRequest) {
  const amount = request.payment?.amount.value ?? "0.00";
  const currency = request.payment?.amount.currency ?? "EUR";
  if ("PaymentRequest" in window) {
    try {
      const paymentRequest = new PaymentRequest([{
        supportedMethods: "basic-card"
      }], {
        total: {
          label: message.subject,
          amount: { currency, value: amount }
        }
      });
      const response = await paymentRequest.show();
      await response.complete("success");
      state.eventLog.unshift(t("eventPaymentCompleted", { invoice: request.payment?.invoiceId ?? message.id }));
      return;
    } catch (error) {
      state.eventLog.unshift(t("eventPaymentFallback", { reason: error instanceof Error ? error.name : "unavailable" }));
      return;
    }
  }
  state.eventLog.unshift(t("eventPaymentFallback", { reason: request.payment?.fallbackProvider?.type ?? "api_unavailable" }));
}

function gatewayStatusLabel() {
  if (state.gatewayStatus === "connected") {
    return t("gatewayConnected");
  }
  if (state.gatewayStatus === "connecting") {
    return t("gatewayConnecting");
  }
  return t("gatewayDisconnected");
}

function domainIcon(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function layoutStyle() {
  const sidebarWidth = layoutState.sidebarCompact ? 72 : layoutState.sidebarWidth;
  return [
    `--sidebar-width:${sidebarWidth}px`,
    `--sidebar-expanded-width:${layoutState.sidebarWidth}px`,
    `--inbox-width:${layoutState.inboxWidth}px`,
    `--audit-width:${layoutState.auditWidth}px`
  ].join(";");
}

function loadLayoutState(): LayoutState {
  const fallback: LayoutState = {
    theme: "day",
    sidebarCompact: false,
    sidebarWidth: 320,
    inboxWidth: 390,
    auditWidth: 260
  };
  try {
    const stored = JSON.parse(localStorage.getItem("realtime-mail-layout") ?? "null") as Partial<LayoutState> | null;
    if (!stored) {
      return fallback;
    }
    return {
      theme: stored.theme === "night" ? "night" : "day",
      sidebarCompact: Boolean(stored.sidebarCompact),
      sidebarWidth: clamp(Number(stored.sidebarWidth) || fallback.sidebarWidth, 260, 460),
      inboxWidth: clamp(Number(stored.inboxWidth) || fallback.inboxWidth, 260, 560),
      auditWidth: clamp(Number(stored.auditWidth) || fallback.auditWidth, 220, 440)
    };
  } catch {
    return fallback;
  }
}

function saveLayoutState() {
  localStorage.setItem("realtime-mail-layout", JSON.stringify(layoutState));
}

function applyTheme() {
  document.documentElement.dataset.theme = layoutState.theme;
}

function startResize(event: PointerEvent, resizer?: string) {
  if (!resizer) {
    return;
  }
  event.preventDefault();
  const startX = event.clientX;
  const initial = {
    sidebar: layoutState.sidebarWidth,
    inbox: layoutState.inboxWidth,
    audit: layoutState.auditWidth
  };

  const move = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX;
    if (resizer === "sidebar") {
      layoutState.sidebarWidth = clamp(initial.sidebar + delta, 260, 460);
      layoutState.sidebarCompact = false;
    }
    if (resizer === "inbox") {
      layoutState.inboxWidth = clamp(initial.inbox + delta, 260, 560);
    }
    if (resizer === "audit") {
      layoutState.auditWidth = clamp(initial.audit - delta, 220, 440);
    }
    const shell = document.querySelector<HTMLElement>(".shell");
    if (shell) {
      shell.classList.toggle("sidebar-compact", layoutState.sidebarCompact);
      shell.setAttribute("style", layoutStyle());
    }
  };

  const stop = () => {
    saveLayoutState();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop, { once: true });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
