export type Locale = "en" | "fr";

let locale: Locale = loadLocale();

const dictionaries = {
  en: {
    appTitle: "Realtime Mail",
    appSubtitle: "Open trusted messaging client",
    domains: "Domains",
    mailAccounts: "Mail accounts",
    gateway: "Gateway",
    broker: "Broker",
    brokerValue: "Simulated RabbitMQ",
    transport: "Transport",
    transportValue: "WebSocket/SSE gateway",
    isolation: "Isolation",
    isolationValue: "Sandboxed iframe per message",
    inbox: "Inbox",
    inboxSubtitle: "IMAP + realtime messages",
    receive: "Receive",
    simulate: "Simulate",
    themeToggleTitle: "Switch day or night theme",
    dayMode: "Day",
    nightMode: "Night",
    compactSidebarTitle: "Compact trusted domains",
    resizeSidebar: "Resize trusted domains column",
    resizeInbox: "Resize message list column",
    resizeReader: "Resize reader and audit columns",
    language: "Language",
    connectGateway: "Connect",
    publishSigned: "Signed event",
    publishGame: "Mini game",
    publishPayment: "Payment",
    gatewayStatus: "Status",
    gatewayDisconnected: "disconnected",
    gatewayConnecting: "connecting",
    gatewayConnected: "connected",
    gatewayVerified: "signature verified",
    gatewayRejected: "signature rejected",
    gatewayManifestLoaded: "Gateway manifest loaded: {domain}",
    gatewayConnectedEvent: "Gateway connected: {route}",
    gatewayError: "Gateway error: {error}",
    gatewayPublishRequested: "Requested signed gateway event",
    gatewayGamePublishRequested: "Requested signed mini game",
    gatewayPaymentPublishRequested: "Requested signed payment email",
    gatewayMessageVerified: "Verified gateway message: {id}",
    gatewayMessageRejected: "Rejected gateway message: {id}",
    gatewayMessageSuppressed: "Suppressed deleted or revoked gateway message: {id}",
    gatewayReconnecting: "Gateway reconnect scheduled: attempt {count}",
    gatewayDiagnostics: "Gateway diagnostics",
    lastError: "Last error",
    reconnectAttempts: "Reconnect attempts",
    lastEvent: "Last event",
    never: "never",
    audit: "Audit",
    security: "Security",
    state: "State",
    domainState: "Domain state",
    messageState: "Message state",
    signature: "Signature",
    capabilities: "Capabilities",
    expiry: "Expiry",
    sandbox: "Sandbox",
    paymentPayload: "Payment payload",
    cspNetwork: "Network blocked by CSP",
    allowed: "allowed",
    denied: "denied",
    none: "none",
    trustedToggleTitle: "Enable or revoke domain trust",
    connected: "connected",
    auth: "auth",
    blocked: "blocked",
    htmlCssJs: "html/css/js",
    htmlCss: "html/css",
    emailHtml: "email html",
    mail: "mail",
    realtimeShort: "rt",
    now: "now",
    minuteSuffix: "min",
    blockedTitle: "Blocked content",
    blockedBody: "The domain {domain} does not have the permissions required by this message.",
    scriptRemoved: "JavaScript removed: this domain is limited to HTML/CSS.",
    eventClientStarted: "Client started",
    eventManifestsLoaded: "Loaded .well-known manifests",
    eventRealtimeSubscriptionBilling: "Subscribed to billing.acme.tld / invoice-events",
    eventRealtimeSubscriptionStatus: "Subscribed to status.ops.tld / incident-feed",
    eventDomainTrusted: "Trusted domain: {domain}",
    eventDomainRevoked: "Revoked domain: {domain}",
    eventSubscribed: "Subscribed: {domain}/{channel}",
    eventUnsubscribed: "Unsubscribed: {domain}/{channel}",
    eventDomainRemoved: "Removed trusted domain subscription: {domain}",
    eventDomainMuted: "Muted trusted domain: {domain}",
    eventMessageDeleted: "Deleted realtime message: {id}",
    eventMessageDismissed: "Dismissed realtime message: {id}",
    eventMessageSuperseded: "Superseded realtime message: {id}",
    eventBroker: "Broker -> {domain}/{channel}",
    eventSandboxAction: "Sandbox action: {action}",
    eventSandboxActionAccepted: "Sandbox action accepted: {action}",
    eventSandboxActionRejected: "Sandbox action rejected: {action}",
    eventPaymentCompleted: "Payment completed for invoice: {invoice}",
    eventPaymentFallback: "Host payment UI fallback: {reason}",
    deleteMessage: "Delete",
    dismissMessage: "Dismiss",
    supersedeMessage: "Supersede",
    muteDomain: "Mute domain",
    domainMuted: "Muted",
    removeDomain: "Remove domain",
    domainRemoved: "Removed",
    emptyInbox: "No visible messages",
    emptyReaderTitle: "No message selected",
    emptyReaderBody: "Messages deleted by the user or blocked by revoked subscriptions stay hidden.",
    invoiceChannel: "Invoices",
    paymentsChannel: "Payments",
    incidentsChannel: "Incidents",
    promosChannel: "Promos",
    billingProof: "DNS TXT + signed manifest",
    statusProof: "Well-known HTTPS + pinned public key",
    unknownProof: "No verified proof",
    invoiceDescription: "Invoices, receipts, and signed payment actions.",
    paymentDescription: "Realtime payment alerts and confirmations.",
    incidentDescription: "Non-interactive HTML incident bulletins.",
    promoDescription: "Unapproved domain in this POC.",
    invoiceSubject: "Invoice #2026-0608 ready",
    invoiceHeading: "Invoice #2026-0608",
    invoiceBody: "Your monthly invoice is available. This domain is approved for sandboxed HTML, CSS, and JS.",
    total: "Total",
    dueDate: "Due date",
    dueDateValue: "June 18, 2026",
    payButton: "Simulate payment",
    invoiceActionResult: "Local action accepted: the host would receive a signed request.",
    statusSubject: "Incident resolved on eu-west",
    resolved: "RESOLVED",
    statusHeading: "High latency on eu-west",
    statusBody: "Traffic is back to normal. This domain is trusted for HTML/CSS, but not for JavaScript.",
    detection: "Automatic detection",
    failover: "Traffic failover",
    recovery: "Progressive recovery",
    promoSubject: "Aggressive promo blocked",
    promoHeading: "Special offer",
    promoBody: "This content asks for JS, but the domain is not approved.",
    promoButton: "Install coupon",
    traditionalSubject: "Traditional email rendered without JS",
    traditionalHeading: "Classic newsletter",
    traditionalBody: "This message comes from a traditional mail account. It appears in the same inbox as realtime messages, but JavaScript remains disabled.",
    openLink: "Open link in browser",
    brokerSubject: "Realtime event #{count}",
    brokerHeading: "Message pushed by the broker",
    brokerBody: "This message simulates RabbitMQ delivery relayed by an authenticated WebSocket gateway.",
    brokerAck: "Acknowledge",
    brokerAckResult: "Local ACK sent to the sandbox host."
  },
  fr: {
    appTitle: "Realtime Mail",
    appSubtitle: "Client ouvert de messagerie de confiance",
    domains: "Domaines",
    mailAccounts: "Comptes mail",
    gateway: "Gateway",
    broker: "Broker",
    brokerValue: "RabbitMQ simule",
    transport: "Transport",
    transportValue: "Gateway WebSocket/SSE",
    isolation: "Isolation",
    isolationValue: "Iframe sandbox par message",
    inbox: "Inbox",
    inboxSubtitle: "Messages IMAP + realtime",
    receive: "Recevoir",
    simulate: "Simuler",
    themeToggleTitle: "Basculer le theme jour ou nuit",
    dayMode: "Jour",
    nightMode: "Nuit",
    compactSidebarTitle: "Reduire les trusted domains",
    resizeSidebar: "Redimensionner la colonne des domaines",
    resizeInbox: "Redimensionner la colonne des messages",
    resizeReader: "Redimensionner la lecture et l'audit",
    language: "Langue",
    connectGateway: "Connecter",
    publishSigned: "Event signe",
    publishGame: "Mini-jeu",
    publishPayment: "Paiement",
    gatewayStatus: "Statut",
    gatewayDisconnected: "deconnecte",
    gatewayConnecting: "connexion",
    gatewayConnected: "connecte",
    gatewayVerified: "signature verifiee",
    gatewayRejected: "signature rejetee",
    gatewayManifestLoaded: "Manifest gateway charge: {domain}",
    gatewayConnectedEvent: "Gateway connectee: {route}",
    gatewayError: "Erreur gateway: {error}",
    gatewayPublishRequested: "Evenement signe demande a la gateway",
    gatewayGamePublishRequested: "Mini-jeu signe demande a la gateway",
    gatewayPaymentPublishRequested: "Email de paiement signe demande a la gateway",
    gatewayMessageVerified: "Message gateway verifie: {id}",
    gatewayMessageRejected: "Message gateway rejete: {id}",
    gatewayMessageSuppressed: "Message gateway supprime ou revoque masque: {id}",
    gatewayReconnecting: "Reconnexion gateway planifiee: tentative {count}",
    gatewayDiagnostics: "Diagnostics gateway",
    lastError: "Derniere erreur",
    reconnectAttempts: "Tentatives de reconnexion",
    lastEvent: "Dernier evenement",
    never: "jamais",
    audit: "Audit",
    security: "Securite",
    state: "Etat",
    domainState: "Etat domaine",
    messageState: "Etat message",
    signature: "Signature",
    capabilities: "Capabilities",
    expiry: "Expiration",
    sandbox: "Sandbox",
    paymentPayload: "Payload paiement",
    cspNetwork: "Reseau bloque par CSP",
    allowed: "autorise",
    denied: "refuse",
    none: "aucun",
    trustedToggleTitle: "Activer ou retirer la confiance du domaine",
    connected: "connecte",
    auth: "auth",
    blocked: "bloque",
    htmlCssJs: "html/css/js",
    htmlCss: "html/css",
    emailHtml: "email html",
    mail: "mail",
    realtimeShort: "rt",
    now: "maintenant",
    minuteSuffix: "min",
    blockedTitle: "Contenu bloque",
    blockedBody: "Le domaine {domain} n'a pas les permissions requises pour ce message.",
    scriptRemoved: "JavaScript retire: ce domaine est limite a HTML/CSS.",
    eventClientStarted: "Client demarre",
    eventManifestsLoaded: "Manifests .well-known charges",
    eventRealtimeSubscriptionBilling: "Abonnement a billing.acme.tld / invoice-events",
    eventRealtimeSubscriptionStatus: "Abonnement a status.ops.tld / incident-feed",
    eventDomainTrusted: "Domaine approuve: {domain}",
    eventDomainRevoked: "Domaine revoque: {domain}",
    eventSubscribed: "Abonnement: {domain}/{channel}",
    eventUnsubscribed: "Desabonnement: {domain}/{channel}",
    eventDomainRemoved: "Abonnement trusted domain supprime: {domain}",
    eventDomainMuted: "Domaine trusted mis en sourdine: {domain}",
    eventMessageDeleted: "Message realtime supprime: {id}",
    eventMessageDismissed: "Message realtime ignore: {id}",
    eventMessageSuperseded: "Message realtime remplace: {id}",
    eventBroker: "Broker -> {domain}/{channel}",
    eventSandboxAction: "Action sandbox: {action}",
    eventSandboxActionAccepted: "Action sandbox acceptee: {action}",
    eventSandboxActionRejected: "Action sandbox rejetee: {action}",
    eventPaymentCompleted: "Paiement effectue pour la facture: {invoice}",
    eventPaymentFallback: "Fallback UI paiement host: {reason}",
    deleteMessage: "Supprimer",
    dismissMessage: "Ignorer",
    supersedeMessage: "Remplacer",
    muteDomain: "Sourdine domaine",
    domainMuted: "Sourdine",
    removeDomain: "Supprimer domaine",
    domainRemoved: "Supprime",
    emptyInbox: "Aucun message visible",
    emptyReaderTitle: "Aucun message selectionne",
    emptyReaderBody: "Les messages supprimes ou bloques par un abonnement revoque restent masques.",
    invoiceChannel: "Factures",
    paymentsChannel: "Paiements",
    incidentsChannel: "Incidents",
    promosChannel: "Promos",
    billingProof: "DNS TXT + manifest signe",
    statusProof: "Well-known HTTPS + cle publique epinglee",
    unknownProof: "Aucune preuve verifiee",
    invoiceDescription: "Factures, recus et actions de paiement signees.",
    paymentDescription: "Alertes de paiement et confirmations temps reel.",
    incidentDescription: "Bulletins HTML non interactifs pour les incidents.",
    promoDescription: "Domaine non approuve dans ce POC.",
    invoiceSubject: "Facture #2026-0608 prete",
    invoiceHeading: "Facture #2026-0608",
    invoiceBody: "Votre facture mensuelle est disponible. Ce domaine est approuve pour HTML, CSS et JS sandboxe.",
    total: "Total",
    dueDate: "Echeance",
    dueDateValue: "18 juin 2026",
    payButton: "Simuler le paiement",
    invoiceActionResult: "Action locale acceptee: le host recevrait une demande signee.",
    statusSubject: "Incident resolu sur eu-west",
    resolved: "RESOLU",
    statusHeading: "Latence elevee sur eu-west",
    statusBody: "Le trafic est revenu a la normale. Ce domaine est trusted pour HTML/CSS, mais pas pour JavaScript.",
    detection: "Detection automatique",
    failover: "Bascule du trafic",
    recovery: "Retour progressif",
    promoSubject: "Promo agressive bloquee",
    promoHeading: "Offre speciale",
    promoBody: "Ce contenu demande du JS, mais le domaine n'est pas approuve.",
    promoButton: "Installer un coupon",
    traditionalSubject: "Email traditionnel rendu sans JS",
    traditionalHeading: "Newsletter classique",
    traditionalBody: "Ce message vient d'un compte mail traditionnel. Il apparait dans la meme inbox que les messages realtime, mais le JavaScript reste coupe.",
    openLink: "Ouvrir le lien dans le navigateur",
    brokerSubject: "Evenement realtime #{count}",
    brokerHeading: "Message pousse par le broker",
    brokerBody: "Ce message simule une livraison RabbitMQ relayee par une gateway WebSocket authentifiee.",
    brokerAck: "Accuser reception",
    brokerAckResult: "ACK local envoye au host sandbox."
  }
} as const;

type MessageKey = keyof typeof dictionaries.en;

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let value: string = dictionaries[locale][key];
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

export function currentLocale(): Locale {
  return locale;
}

export function setLocale(nextLocale: Locale): void {
  locale = nextLocale;
  try {
    localStorage.setItem("realtime-mail.locale", nextLocale);
  } catch {
    // Locale persistence is optional in embedded clients.
  }
}

function loadLocale(): Locale {
  try {
    return localStorage.getItem("realtime-mail.locale") === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function createManifests() {
  return [
    {
      domain: "billing.acme.tld",
      displayName: "ACME Billing",
      verifiedBy: t("billingProof"),
      permissions: ["html", "interactive"],
      channels: [
        {
          id: "invoice-events",
          label: t("invoiceChannel"),
          route: "/rt/invoices/:userId",
          description: t("invoiceDescription")
        },
        {
          id: "payment-alerts",
          label: t("paymentsChannel"),
          route: "/rt/payments/:userId",
          description: t("paymentDescription")
        }
      ]
    },
    {
      domain: "status.ops.tld",
      displayName: "Ops Status",
      verifiedBy: t("statusProof"),
      permissions: ["html"],
      channels: [
        {
          id: "incident-feed",
          label: t("incidentsChannel"),
          route: "/rt/incidents",
          description: t("incidentDescription")
        }
      ]
    },
    {
      domain: "unknown-shop.tld",
      displayName: "Unknown Shop",
      verifiedBy: t("unknownProof"),
      permissions: [],
      channels: [
        {
          id: "promo-feed",
          label: t("promosChannel"),
          route: "/rt/promos",
          description: t("promoDescription")
        }
      ]
    }
  ];
}

export function createTraditionalAccounts() {
  return [
    {
      id: "personal-imap",
      email: "alex@example.com",
      provider: "IMAP/SMTP",
      incoming: "imap.example.com:993",
      outgoing: "smtp.example.com:587",
      status: "connected"
    },
    {
      id: "work-imap",
      email: "alex@company.tld",
      provider: "Microsoft 365 IMAP",
      incoming: "outlook.office365.com:993",
      outgoing: "smtp.office365.com:587",
      status: "needs-auth"
    }
  ];
}

export function createSeedMessages() {
  return [
    {
      id: "m-001",
      source: "realtime",
      domain: "billing.acme.tld",
      channelId: "invoice-events",
      subject: t("invoiceSubject"),
      from: "billing@acme.tld",
      receivedAt: new Date(Date.now() - 1000 * 60 * 3),
      requires: "interactive",
      html: `
        <article class="invoice">
          <p class="kicker">ACME Billing</p>
          <h1>${t("invoiceHeading")}</h1>
          <p>${t("invoiceBody")}</p>
          <dl>
            <div><dt>${t("total")}</dt><dd>184,90 EUR</dd></div>
            <div><dt>${t("dueDate")}</dt><dd>${t("dueDateValue")}</dd></div>
          </dl>
          <button id="pay">${t("payButton")}</button>
          <p id="result" class="result"></p>
        </article>
      `,
      css: invoiceCss,
      js: `
        document.querySelector("#pay").addEventListener("click", () => {
          document.querySelector("#result").textContent = ${JSON.stringify(t("invoiceActionResult"))};
          parent.postMessage({ type: "trusted-mail-action", action: "pay-invoice", invoice: "2026-0608" }, "*");
        });
      `
    },
    {
      id: "m-002",
      source: "realtime",
      domain: "status.ops.tld",
      channelId: "incident-feed",
      subject: t("statusSubject"),
      from: "status@ops.tld",
      receivedAt: new Date(Date.now() - 1000 * 60 * 11),
      requires: "html",
      html: `
        <section class="status">
          <p class="badge">${t("resolved")}</p>
          <h1>${t("statusHeading")}</h1>
          <p>${t("statusBody")}</p>
          <ol>
            <li>${t("detection")}</li>
            <li>${t("failover")}</li>
            <li>${t("recovery")}</li>
          </ol>
        </section>
      `,
      css: statusCss
    },
    {
      id: "m-003",
      source: "realtime",
      domain: "unknown-shop.tld",
      channelId: "promo-feed",
      subject: t("promoSubject"),
      from: "promo@unknown-shop.tld",
      receivedAt: new Date(Date.now() - 1000 * 60 * 27),
      requires: "interactive",
      html: `
        <h1>${t("promoHeading")}</h1>
        <p>${t("promoBody")}</p>
        <button>${t("promoButton")}</button>
      `,
      css: `body { font-family: sans-serif; padding: 24px; }`,
      js: `document.body.dataset.untrusted = "attempted";`
    },
    {
      id: "m-004",
      source: "traditional",
      domain: "example.com",
      channelId: "personal-imap",
      subject: t("traditionalSubject"),
      from: "newsletter@example.com",
      receivedAt: new Date(Date.now() - 1000 * 60 * 44),
      requires: "html",
      html: `
        <article class="classic">
          <p class="label">IMAP</p>
          <h1>${t("traditionalHeading")}</h1>
          <p>${t("traditionalBody")}</p>
          <a href="https://example.com">${t("openLink")}</a>
        </article>
      `,
      css: traditionalCss
    }
  ];
}

export function createBrokerMessageContent(domain: string, channelId: string, count: number, interactive: boolean) {
  return {
    subject: t("brokerSubject", { count }),
    html: `
      <main class="event">
        <p class="source">${domain} / ${channelId}</p>
        <h1>${t("brokerHeading")}</h1>
        <p>${t("brokerBody")}</p>
        ${interactive ? `<button id="ack">${t("brokerAck")}</button><p id="ackText"></p>` : ""}
      </main>
    `,
    css: brokerCss,
    js: interactive
      ? `document.querySelector("#ack").addEventListener("click", () => document.querySelector("#ackText").textContent = ${JSON.stringify(t("brokerAckResult"))});`
      : undefined
  };
}

const invoiceCss = `
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #17211b; background: #f9fbf8; }
  .invoice { padding: 24px; }
  .kicker { margin: 0 0 8px; color: #42644d; font-weight: 700; font-size: 12px; text-transform: uppercase; }
  h1 { margin: 0 0 12px; font-size: 28px; }
  p { line-height: 1.5; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 20px 0; }
  dl div { border: 1px solid #dbe7dc; background: #fff; border-radius: 8px; padding: 14px; }
  dt { color: #5a6e61; font-size: 12px; }
  dd { margin: 4px 0 0; font-size: 20px; font-weight: 800; }
  button { border: 0; border-radius: 7px; background: #1d6f42; color: #fff; padding: 11px 14px; font-weight: 700; cursor: pointer; }
  .result { color: #1d6f42; font-weight: 700; min-height: 24px; }
`;

const statusCss = `
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #181b20; background: #fbfaf6; }
  .status { padding: 24px; }
  .badge { display: inline-block; margin: 0 0 12px; padding: 6px 9px; border-radius: 6px; background: #d9f1df; color: #175b2b; font-size: 12px; font-weight: 800; }
  h1 { margin: 0 0 12px; font-size: 26px; }
  p, li { line-height: 1.5; }
`;

const traditionalCss = `
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #1f2328; background: #fbfbfd; }
  .classic { padding: 24px; }
  .label { color: #5b6572; font-size: 12px; font-weight: 800; text-transform: uppercase; }
  h1 { margin: 0 0 12px; font-size: 26px; }
  p { line-height: 1.5; }
  a { color: #155e75; font-weight: 800; }
`;

const brokerCss = `
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #16201c; background: #f7fbfb; }
  .event { padding: 24px; }
  .source { color: #546d69; font-size: 12px; font-weight: 800; text-transform: uppercase; }
  h1 { margin: 0 0 12px; font-size: 26px; }
  p { line-height: 1.5; }
  button { border: 0; border-radius: 7px; background: #0f766e; color: white; padding: 10px 13px; font-weight: 800; }
  #ackText { color: #0f766e; font-weight: 800; }
`;
