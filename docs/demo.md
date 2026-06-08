# Trusted Enriched Email Demo

This page shows the three demo moments that make the standard tangible: a payable invoice, a sandboxed mini-game, and a visible trust panel. The examples mirror the reference client design: compact mail layout, explicit capabilities, and host-owned decisions.

<div class="demo-shell">
  <aside class="demo-sidebar">
    <div class="demo-brand">
      <span>RT</span>
      <div>
        <strong>Realtime Mail</strong>
        <small>Trusted enriched inbox</small>
      </div>
    </div>
    <button class="demo-domain active" type="button">
      <span>AC</span>
      <strong>ACME Billing</strong>
      <small>trusted</small>
    </button>
    <button class="demo-domain" type="button">
      <span>ST</span>
      <strong>Status Hub</strong>
      <small>muted</small>
    </button>
    <button class="demo-domain" type="button">
      <span>RW</span>
      <strong>Rewards</strong>
      <small>trusted</small>
    </button>
  </aside>
  <section class="demo-list">
    <button class="demo-message active" type="button" data-demo-message="payment">
      <strong>Invoice #2026-0608</strong>
      <span>Pay inside the host client</span>
      <em>verified</em>
    </button>
    <button class="demo-message" type="button" data-demo-message="game">
      <strong>Scratch reward game</strong>
      <span>Sandboxed HTML5 mini-game</span>
      <em>interactive</em>
    </button>
    <button class="demo-message" type="button" data-demo-message="trust">
      <strong>Security explanation</strong>
      <span>Trust, signature, capabilities</span>
      <em>auditable</em>
    </button>
  </section>
  <section class="demo-reader">
    <article class="demo-reader-view active" data-demo-view="payment">
      <div class="demo-reader-head">
        <div>
          <small>billing.acme.tld</small>
          <h2>Secure in-client payment request</h2>
        </div>
        <span class="demo-pill ok">verified</span>
      </div>
      <div class="demo-invoice">
        <div>
          <small>Amount due</small>
          <strong>184.90 EUR</strong>
          <p>Payment is requested by the sandboxed message, but confirmed by the host client.</p>
        </div>
        <div class="demo-qr" aria-label="QR payment fallback">
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
        </div>
      </div>
      <div class="demo-actions">
        <button type="button" data-demo-action="payment">Request payment</button>
        <button type="button" data-demo-action="qr">Show QR fallback</button>
      </div>
      <p class="demo-host-result" aria-live="polite">Host action broker is waiting for a user request.</p>
    </article>
    <article class="demo-reader-view" data-demo-view="game">
      <div class="demo-reader-head">
        <div>
          <small>rewards.acme.tld</small>
          <h2>Scratch reward game</h2>
        </div>
        <span class="demo-pill ok">sandboxed</span>
      </div>
      <div class="demo-game-canvas demo-game-live">
        <canvas width="520" height="260" data-demo-game aria-label="Sandboxed reward mini-game"></canvas>
        <div class="demo-game-hud">
          <strong data-demo-score>0</strong>
          <small>tokens collected</small>
        </div>
      </div>
      <div class="demo-actions">
        <button type="button" data-demo-action="start-game">Start game</button>
        <button type="button" data-demo-action="claim-reward">Claim reward</button>
      </div>
      <p class="demo-host-result" aria-live="polite">Click the moving tokens. The mini-game can animate and request host actions, but it cannot read mailbox data.</p>
    </article>
    <article class="demo-reader-view" data-demo-view="trust">
      <div class="demo-reader-head">
        <div>
          <small>client security panel</small>
          <h2>Verified trust explanation</h2>
        </div>
        <span class="demo-pill ok">auditable</span>
      </div>
      <div class="demo-trust-panel compact">
        <div>
          <span class="demo-dot ok"></span>
          <strong>Signature</strong>
          <small>Ed25519 verified against manifest key</small>
        </div>
        <div>
          <span class="demo-dot ok"></span>
          <strong>Domain</strong>
          <small>billing.acme.tld is trusted locally</small>
        </div>
        <div>
          <span class="demo-dot warn"></span>
          <strong>Capabilities</strong>
          <small>HTML, CSS, sandboxed script, payment request</small>
        </div>
        <div>
          <span class="demo-dot ok"></span>
          <strong>Expiry</strong>
          <small>Interactive actions disabled after expiry</small>
        </div>
      </div>
    </article>
  </section>
</div>

## Case 1: Payable Invoice

The invoice demo is the flagship use case. The message can present a payment action, but the sandbox never receives card data, payment credentials, cookies, account tokens, or full receipts.

<div class="demo-grid">
  <section class="demo-card">
    <h3>What the message can do</h3>
    <ul>
      <li>Display invoice details and merchant identity.</li>
      <li>Request a host-mediated payment action.</li>
      <li>Offer a QR fallback controlled by the merchant or trusted provider.</li>
    </ul>
  </section>
  <section class="demo-card">
    <h3>What the host verifies</h3>
    <ul>
      <li>Signed message, trusted domain, declared capability, expiry, iframe source, invoice id, amount, currency, and merchant domain.</li>
      <li>Duplicate invoice ids are rejected through local idempotence state.</li>
    </ul>
  </section>
</div>

## Case 2: Sandboxed Mini-Game

An enriched email can feel alive without becoming privileged. The mini-game runs as sandboxed message content and gets only the capabilities approved by the manifest and local trust policy.

<div class="demo-game">
  <div class="demo-game-canvas">
    <span class="demo-token a"></span>
    <span class="demo-token b"></span>
    <span class="demo-token c"></span>
    <strong>Scratch to reveal</strong>
  </div>
  <div>
    <h3>Safe by construction</h3>
    <p>The game can animate, react to clicks, and request an allowed host action. It cannot read the mailbox, call arbitrary network endpoints, access host cookies, or bypass the client action broker.</p>
    <code>run:script-sandboxed</code>
  </div>
</div>

## Case 3: Verified Trust Panel

The client should explain why an enriched message is allowed to run. This is what makes the model credible for users, developers, and security reviewers.

<div class="demo-trust-panel">
  <div>
    <span class="demo-dot ok"></span>
    <strong>Signature</strong>
    <small>Ed25519 verified against manifest key</small>
  </div>
  <div>
    <span class="demo-dot ok"></span>
    <strong>Domain</strong>
    <small>billing.acme.tld is trusted locally</small>
  </div>
  <div>
    <span class="demo-dot warn"></span>
    <strong>Capabilities</strong>
    <small>HTML, CSS, sandboxed script, payment request</small>
  </div>
  <div>
    <span class="demo-dot ok"></span>
    <strong>Expiry</strong>
    <small>Interactive actions disabled after expiry</small>
  </div>
</div>

## Try It Locally

Run the reference gateway and web client, then publish the payment and game demos:

```bash
npm.cmd run gateway:start
npm.cmd run dev
```

The hosted documentation explains the idea. The local reference client proves the signed, sandboxed, host-mediated flow end to end.

<script src="assets/demo.js" defer></script>
