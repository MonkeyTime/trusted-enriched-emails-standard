package org.realtimemail;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

public final class HostActionBroker {
  private final TrustPolicy trustPolicy;
  private final SignatureVerifier verifier;

  public HostActionBroker(TrustPolicy trustPolicy, SignatureVerifier verifier) {
    this.trustPolicy = trustPolicy;
    this.verifier = verifier;
  }

  public HostActionDecision authorize(
    RealtimeMailAction action,
    RealtimeMailMessage message,
    RealtimeMailManifest manifest,
    boolean userGesture,
    Instant now
  ) {
    if (!new ActionValidator().validate(action).isEmpty()) return rejected("invalid_action");
    if (!action.messageId().equals(message.id())) return rejected("message_mismatch");
    if (!action.domain().equals(message.domain()) || !action.domain().equals(manifest.domain())) return rejected("domain_mismatch");
    if (!trustPolicy.isTrusted(action.domain())) return rejected("domain_not_trusted");
    if (!userGesture || !action.requiresUserGesture()) return rejected("user_gesture_required");
    if (message.expiresAt().isPresent() && !message.expiresAt().get().isAfter(now)) return rejected("message_expired");
    if (manifest.publicKeys().stream().noneMatch(key -> key.startsWith("ed25519:") && verifier.verifyEd25519(message, key))) {
      return rejected("signature_required");
    }
    if (action.type() == RealtimeMailActionType.OPEN_URL && !message.capabilities().contains(TrustCapability.OPEN_URL_USER_GESTURE)) {
      return rejected("capability_required");
    }
    if (isPaymentRequest(action) && !message.capabilities().contains(TrustCapability.PAYMENT_REQUEST_USER_GESTURE)) {
      return rejected("capability_required");
    }
    return new HostActionDecision(true, "ok", Optional.of(action));
  }

  private static boolean isPaymentRequest(RealtimeMailAction action) {
    return action.payload().isPresent()
      && action.payload().get() instanceof Map<?, ?> payload
      && "host-mediated-payment-request".equals(payload.get("kind"));
  }

  private static HostActionDecision rejected(String reason) {
    return new HostActionDecision(false, reason, Optional.empty());
  }
}
