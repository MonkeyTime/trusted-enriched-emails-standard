package org.realtimemail;

import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public final class ConformanceSmoke {
  public static void main(String[] args) throws Exception {
    validateManifest();
    validateMessage();
    validateAction();
    verifySignature();
    verifyGatewayProfile();
    System.out.println("PASS Java conformance smoke");
  }

  private static void validateAction() {
    var valid = new RealtimeMailAction(
      "open-invoice",
      "msg_2026_0608_001",
      "billing.acme.tld",
      RealtimeMailActionType.OPEN_URL,
      true,
      Optional.of("https://billing.acme.tld/invoices/2026-0608"),
      Optional.empty()
    );
    if (!new ActionValidator().validate(valid).isEmpty()) {
      throw new IllegalStateException("valid action rejected");
    }

    var invalid = new RealtimeMailAction(
      "open-invoice",
      "msg_2026_0608_001",
      "billing.acme.tld",
      RealtimeMailActionType.OPEN_URL,
      false,
      Optional.of("https://billing.acme.tld/invoices/2026-0608"),
      Optional.empty()
    );
    if (new ActionValidator().validate(invalid).isEmpty()) {
      throw new IllegalStateException("invalid action accepted");
    }

    var crossDomain = new RealtimeMailAction(
      "open-invoice",
      "msg_2026_0608_001",
      "billing.acme.tld",
      RealtimeMailActionType.OPEN_URL,
      true,
      Optional.of("https://evil.example/invoices/2026-0608"),
      Optional.empty()
    );
    if (new ActionValidator().validate(crossDomain).isEmpty()) {
      throw new IllegalStateException("cross-domain action accepted");
    }
  }

  private static void validateManifest() {
    var manifest = new RealtimeMailManifest(
      "realtime-mail",
      "0.1-draft",
      "billing.acme.tld",
      "ACME Billing",
      List.of("ed25519:W11Aq3u9PGk8t2aRb7z3vP6uqQKABpKc7p7BxN7F3dE"),
      List.of(new RealtimeMailChannel(
        "invoice-events",
        "Invoices",
        "/rt/invoices/:userId",
        "Invoices, receipts, and signed payment actions.",
        List.of(TrustCapability.RENDER_HTML, TrustCapability.RENDER_CSS)
      ))
    );
    if (!new ManifestValidator().validate(manifest).isEmpty()) {
      throw new IllegalStateException("valid manifest rejected");
    }

    var invalid = new RealtimeMailManifest("realtime-mail", "0.1-draft", "billing.acme.tld", "ACME Billing", List.of(), List.of());
    if (new ManifestValidator().validate(invalid).isEmpty()) {
      throw new IllegalStateException("invalid manifest accepted");
    }
  }

  private static void validateMessage() {
    var message = validMessage(Optional.of("placeholder"));
    if (!new MessageValidator().validate(message).isEmpty()) {
      throw new IllegalStateException("valid message rejected");
    }

    var invalid = new RealtimeMailMessage(
      "bad",
      MailSource.REALTIME,
      "billing.acme.tld",
      Optional.of("invoice-events"),
      "billing@acme.tld",
      "Bad script",
      "<button>Click</button>",
      Optional.empty(),
      Optional.of("alert('nope')"),
      List.of(TrustCapability.RENDER_HTML),
      Instant.parse("2026-06-08T08:00:00Z"),
      Optional.empty(),
      Optional.of("rmail1.header.signature")
    );
    if (new MessageValidator().validate(invalid).isEmpty()) {
      throw new IllegalStateException("invalid message accepted");
    }
  }

  private static void verifySignature() throws Exception {
    var keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    var message = validMessage(Optional.empty());
    var verifier = new SignatureVerifier();
    var signer = Signature.getInstance("Ed25519");
    signer.initSign(keyPair.getPrivate());
    signer.update(verifier.canonicalMessage(message).getBytes());
    var signature = signer.sign();
    var signed = validMessage(Optional.of("rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature)));
    var publicKey = "ed25519:" + Base64.getUrlEncoder().withoutPadding().encodeToString(rawEd25519PublicKey(keyPair.getPublic().getEncoded()));

    if (!verifier.verifyEd25519(signed, publicKey)) {
      throw new IllegalStateException("valid signature rejected");
    }

    var tampered = new RealtimeMailMessage(
      signed.id(),
      signed.source(),
      signed.domain(),
      signed.channelId(),
      signed.from(),
      "Tampered",
      signed.html(),
      signed.css(),
      signed.script(),
      signed.capabilities(),
      signed.receivedAt(),
      signed.expiresAt(),
      signed.signature()
    );
    if (verifier.verifyEd25519(tampered, publicKey)) {
      throw new IllegalStateException("tampered message accepted");
    }
  }

  private static void verifyGatewayProfile() throws Exception {
    var keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    var publicKey = "ed25519:" + Base64.getUrlEncoder().withoutPadding().encodeToString(rawEd25519PublicKey(keyPair.getPublic().getEncoded()));
    var manifest = new RealtimeMailManifest(
      "realtime-mail",
      "0.1-draft",
      "billing.acme.tld",
      "ACME Billing",
      List.of(publicKey),
      List.of(new RealtimeMailChannel(
        "invoice-events",
        "Invoices",
        "/rt/invoices/:userId",
        "",
        List.of(TrustCapability.RENDER_HTML, TrustCapability.RENDER_CSS, TrustCapability.OPEN_URL_USER_GESTURE)
      ))
    );
    var verifier = new SignatureVerifier();
    var message = new RealtimeMessageBuilder(manifest, () -> Instant.parse("2026-06-08T08:00:00Z")).build(
      "invoice-events",
      "billing@acme.tld",
      "Action test",
      "<a>Open</a>",
      Optional.empty(),
      Optional.empty(),
      Optional.of(Instant.parse("2026-06-08T08:15:00Z")),
      Optional.of("host-action-001")
    );
    message = new MessageSigner(verifier).signEd25519(message, keyPair.getPrivate());
    var action = new RealtimeMailAction(
      "open-invoice",
      message.id(),
      message.domain(),
      RealtimeMailActionType.OPEN_URL,
      true,
      Optional.of("https://billing.acme.tld/invoices/1"),
      Optional.empty()
    );
    var trust = new TrustPolicy();
    trust.trustDomain("billing.acme.tld");
    var broker = new HostActionBroker(trust, verifier);
    if (!broker.authorize(action, message, manifest, true, Instant.parse("2026-06-08T08:01:00Z")).ok()) {
      throw new IllegalStateException("valid host action rejected");
    }
    if (broker.authorize(action, message, manifest, false, Instant.parse("2026-06-08T08:01:00Z")).ok()) {
      throw new IllegalStateException("missing user gesture accepted");
    }
    if (broker.authorize(action, message, manifest, true, Instant.parse("2026-06-08T08:16:00Z")).ok()) {
      throw new IllegalStateException("expired message accepted");
    }
    if (!new RouteAuthorizer(manifest).authorize("/rt/invoices/demo-user", Optional.of("invoice-events"), Optional.of("demo-user")).ok()) {
      throw new IllegalStateException("valid route rejected");
    }
    if (new RouteAuthorizer(manifest).authorize("/rt/admin/demo-user", Optional.of("invoice-events"), Optional.of("demo-user")).ok()) {
      throw new IllegalStateException("invalid route accepted");
    }
    var unsafePlaceholderManifest = new RealtimeMailManifest(
      manifest.protocol(),
      manifest.version(),
      manifest.domain(),
      manifest.displayName(),
      manifest.publicKeys(),
      List.of(new RealtimeMailChannel("invoice-events", "Invoices", "/rt/invoices/:accountId", null, List.of(TrustCapability.RENDER_HTML)))
    );
    if (new RouteAuthorizer(unsafePlaceholderManifest).authorize("/rt/invoices/other-user", Optional.of("invoice-events"), Optional.of("demo-user")).ok()) {
      throw new IllegalStateException("unbound route placeholder accepted");
    }
    expectThrows("invalid manifest discovery domain accepted", () -> new ManifestResolver().manifestUri("billing.acme.tld@127.0.0.1"));
    if (!new ActionReceiver("billing.acme.tld").receive(action).ok()) {
      throw new IllegalStateException("valid gateway action rejected");
    }
    var crossDomain = new RealtimeMailAction(
      "open-invoice",
      message.id(),
      "evil.example",
      RealtimeMailActionType.OPEN_URL,
      true,
      Optional.of("https://evil.example/invoices/1"),
      Optional.empty()
    );
    if (new ActionReceiver("billing.acme.tld").receive(crossDomain).ok()) {
      throw new IllegalStateException("cross-domain gateway action accepted");
    }
    var statePolicy = new StatePolicy();
    if (statePolicy.evaluateDomainState("billing.acme.tld", new DomainStateSnapshot(
      Set.of("billing.acme.tld"),
      Set.of(),
      Set.of()
    )) != TrustedDomainState.TRUSTED) {
      throw new IllegalStateException("trusted domain state rejected");
    }
    if (statePolicy.evaluateDomainState("billing.acme.tld", new DomainStateSnapshot(
      Set.of("billing.acme.tld"),
      Set.of("billing.acme.tld"),
      Set.of()
    )) != TrustedDomainState.MUTED) {
      throw new IllegalStateException("muted domain state rejected");
    }
    if (statePolicy.evaluateDomainState("billing.acme.tld", new DomainStateSnapshot(
      Set.of("billing.acme.tld"),
      Set.of(),
      Set.of("billing.acme.tld")
    )) != TrustedDomainState.REVOKED) {
      throw new IllegalStateException("revoked domain state rejected");
    }
    if (statePolicy.evaluateMessageState(message, new MessageStateSnapshot(
      Set.of(),
      Set.of(),
      Set.of(),
      Optional.of(Instant.parse("2026-06-08T08:16:00Z"))
    )) != MessageLifecycleState.EXPIRED) {
      throw new IllegalStateException("expired message state rejected");
    }
    if (statePolicy.evaluateMessageState(message, new MessageStateSnapshot(
      Set.of(message.id()),
      Set.of(message.id()),
      Set.of(),
      Optional.of(Instant.parse("2026-06-08T08:16:00Z"))
    )) != MessageLifecycleState.DELETED) {
      throw new IllegalStateException("deleted message state precedence rejected");
    }
  }

  private static RealtimeMailMessage validMessage(Optional<String> signature) {
    return new RealtimeMailMessage(
      "crypto-vector-001",
      MailSource.REALTIME,
      "billing.acme.tld",
      Optional.of("invoice-events"),
      "billing@acme.tld",
      "Signed message",
      "<article><h1>Signed</h1></article>",
      Optional.of("body { font-family: sans-serif; }"),
      Optional.empty(),
      List.of(TrustCapability.RENDER_HTML, TrustCapability.RENDER_CSS),
      Instant.parse("2026-06-08T08:00:00Z"),
      Optional.empty(),
      signature
    );
  }

  private static byte[] rawEd25519PublicKey(byte[] x509Key) {
    var raw = new byte[32];
    System.arraycopy(x509Key, x509Key.length - 32, raw, 0, 32);
    return raw;
  }

  private static void expectThrows(String message, Runnable action) {
    try {
      action.run();
    } catch (RuntimeException expected) {
      return;
    }
    throw new IllegalStateException(message);
  }
}
