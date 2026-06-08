package org.realtimemail;

import java.security.PrivateKey;
import java.security.Signature;
import java.util.Base64;
import java.util.Optional;

public final class MessageSigner {
  private final SignatureVerifier verifier;

  public MessageSigner(SignatureVerifier verifier) {
    this.verifier = verifier;
  }

  public RealtimeMailMessage signEd25519(RealtimeMailMessage message, PrivateKey privateKey) {
    try {
      var signer = Signature.getInstance("Ed25519");
      signer.initSign(privateKey);
      signer.update(verifier.canonicalMessage(message).getBytes());
      var signature = signer.sign();
      return new RealtimeMailMessage(
        message.id(),
        message.source(),
        message.domain(),
        message.channelId(),
        message.from(),
        message.subject(),
        message.html(),
        message.css(),
        message.script(),
        message.capabilities(),
        message.receivedAt(),
        message.expiresAt(),
        Optional.of("rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature))
      );
    } catch (Exception error) {
      throw new IllegalStateException("Unable to sign message", error);
    }
  }
}
