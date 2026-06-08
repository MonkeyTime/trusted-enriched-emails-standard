# Project Direction

Realtime Mail should become an open standard and developer platform for trusted interactive mail.

The project is not trying to replace traditional email. It adds a realtime, signed, capability-based layer beside existing IMAP, SMTP, provider APIs, and local mail stores.

## Product Thesis

Email clients are conservative because messages are untrusted documents. Realtime Mail changes the trust model by moving interactivity behind explicit domain trust, signed messages, sandboxed rendering, and host-mediated actions.

The result should feel like email when the sender is ordinary, and like a safe mini-application when the sender is a trusted domain.

## Must-Have Outcome

The client becomes useful when it can do all of these well:

- read traditional mail accounts;
- subscribe to trusted realtime domain channels;
- render signed HTML, CSS, SVG, and sandboxed JavaScript;
- explain why a message is trusted, muted, revoked, blocked, deleted, or expired;
- allow safe host-mediated actions such as opening a same-domain URL or requesting a payment flow;
- make user revocation immediate and persistent;
- give developers SDKs that make compliant publishing easier than custom integration.

## Adoption Strategy

Realtime Mail cannot depend on every website changing behavior at once. Adoption should start where the value is unusually obvious:

- invoices and payment requests;
- incident and status feeds;
- delivery tracking;
- account security notifications;
- collaborative approval flows;
- interactive onboarding and education;
- games, rewards, and loyalty campaigns that are clearly sandboxed.

The first production target should be a reference client plus SDKs that make a trusted domain integration faster than building an email template and a separate web app.

## Why Developers Would Integrate

Developers get:

- one message builder and signer per supported language;
- manifest and message validation before publishing;
- route authorization helpers;
- host-action validation;
- RabbitMQ/SSE reference gateway code;
- conformance fixtures that prevent client-specific behavior drift.

The SDKs should become the easiest way to publish a safe interactive message.

## Why Clients Would Integrate

Mail clients get:

- a modern interactive surface without giving arbitrary email JavaScript access to the mailbox;
- a shared capability model instead of per-client hacks;
- a strict parser and signature verifier;
- durable local trust state;
- interoperability with gateway-backed domains;
- a way to show richer messages without weakening traditional email safety.

Thunderbird and browser-based clients are the first realistic integration targets. Native mobile clients are a later target after the core model stabilizes.

## Security Non-Negotiables

These rules define the product:

- realtime messages are untrusted until manifest, signature, domain trust, state policy, and capability checks pass;
- scripts run only in sandboxed message contexts;
- sandboxed content never receives mailbox data, account tokens, payment credentials, or host cookies;
- privileged actions always go through the host action broker;
- payment flows are owned by the host client, not the message;
- unknown schema fields are rejected;
- user deletion, revocation, and unsubscribe decisions must persist locally;
- expired messages lose interactivity.

## Payment Direction

Payment email is a flagship use case, but it must stay host-mediated.

The standard should define a payment request payload that includes:

- invoice id;
- merchant domain;
- amount;
- currency;
- description;
- optional order reference;
- expiry;
- accepted payment provider hints.

The host client may use the browser Payment Request API when available. When it is unavailable, the host should fall back to a trusted provider checkout or a host-controlled confirmation flow.

The sandboxed message may request payment, display status, and receive a coarse result. It must never receive payment credentials or provider tokens.

## Near-Term Product Milestones

### Milestone 1: Reference Experience

- Make the web client feel like a credible mailbox.
- Add security details for every realtime message.
- Add visible domain state controls.
- Add signed mini-game and payment examples.
- Keep traditional mail visible as a first-class source.

### Milestone 2: Standardized Actions

- Define payload profiles for `open_url`, `publish_gateway_event`, and payment request actions.
- Add conformance fixtures for accepted and rejected actions.
- Add SDK helpers so apps do not hand-roll action payloads.

### Milestone 3: Gateway Production Profile

- Add user authentication.
- Bind route placeholders to authenticated users.
- Add durable RabbitMQ queues where appropriate.
- Add audit logs.
- Add retry, dead-letter, and poison-message handling.
- Add stable key loading and rotation.

### Milestone 4: Client Integration

- Build a local backend bridge for IMAP/SMTP accounts.
- Build a Thunderbird proof of integration.
- Package the TypeScript SDK for browser and Node usage.
- Document how clients should persist message and domain state.

### Milestone 5: Open Standard Track

- Publish draft schemas and SDK documentation.
- Publish conformance CLI.
- Create implementer checklist.
- Maintain a compatibility matrix.
- Invite early trusted-domain implementers.

## What To Avoid

- Do not make the client a marketing landing page instead of a usable mailbox.
- Do not let rich content bypass host policy for convenience.
- Do not require clients to connect directly to RabbitMQ or other private broker infrastructure.
- Do not make SDKs cosmetic wrappers; they must enforce the standard.
- Do not rely on Payment Request API as the only payment path.
- Do not hide trust decisions from users.

## Current Best Next Step

The next project increment should be a standardized host-mediated payment profile:

- schema or fixture for a payment action payload;
- TypeScript SDK helper for constructing and validating payment requests;
- equivalent model updates in Python, Go, Rust, Java, and C#;
- web client security detail panel showing the verified invoice payload;
- gateway demo message using the profile.

This gives the project a strong vertical slice: signed gateway message, RabbitMQ delivery, sandboxed UI, host-mediated action, payment fallback, and conformance tests.
