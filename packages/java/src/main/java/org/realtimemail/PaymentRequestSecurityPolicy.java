package org.realtimemail;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class PaymentRequestSecurityPolicy {
  public PaymentRequestSecurityDecision authorize(
    RealtimeMailAction action,
    RealtimeMailMessage message,
    RealtimeMailManifest manifest,
    boolean sourceMatchesSelectedSandbox,
    Optional<String> expectedInvoiceId,
    Optional<String> expectedAmount,
    Optional<String> expectedCurrency,
    List<String> processedInvoiceIds,
    Instant now
  ) {
    if (!sourceMatchesSelectedSandbox) return rejected("untrusted_frame_source");
    var payload = paymentPayload(action.payload());
    if (action.type() != RealtimeMailActionType.PUBLISH_GATEWAY_EVENT || payload.isEmpty()) return rejected("payment_payload_required");
    if (!new PaymentRequestPayloadValidator().validate(payload.get()).isEmpty()) return rejected("invalid_payment_payload");
    if (!action.messageId().equals(message.id())) return rejected("message_mismatch");
    if (!action.domain().equals(message.domain()) || !action.domain().equals(manifest.domain())) return rejected("domain_mismatch");
    var merchant = objectMap(payload.get().get("merchant"));
    if (merchant == null || !message.domain().equals(merchant.get("domain"))) return rejected("merchant_domain_mismatch");
    if (!message.capabilities().contains(TrustCapability.PAYMENT_REQUEST_USER_GESTURE)) return rejected("capability_required");
    if (expectedInvoiceId.isPresent() && !expectedInvoiceId.get().equals(payload.get().get("invoiceId"))) return rejected("invoice_mismatch");
    var amount = objectMap(payload.get().get("amount"));
    if (expectedAmount.isPresent() && (amount == null || !expectedAmount.get().equals(amount.get("value")))) return rejected("amount_mismatch");
    if (expectedCurrency.isPresent() && (amount == null || !expectedCurrency.get().equals(amount.get("currency")))) return rejected("currency_mismatch");
    if (!Instant.parse(String.valueOf(payload.get().get("expiresAt"))).isAfter(now)) return rejected("payment_expired");
    if (processedInvoiceIds.contains(String.valueOf(payload.get().get("invoiceId")))) return rejected("duplicate_invoice");
    return new PaymentRequestSecurityDecision(true, "ok", payload);
  }

  private static PaymentRequestSecurityDecision rejected(String reason) {
    return new PaymentRequestSecurityDecision(false, reason, Optional.empty());
  }

  @SuppressWarnings("unchecked")
  private static Optional<Map<String, Object>> paymentPayload(Optional<Object> payload) {
    if (payload.isEmpty() || !(payload.get() instanceof Map<?, ?> value)) return Optional.empty();
    if (!"host-mediated-payment-request".equals(value.get("kind"))) return Optional.empty();
    return Optional.of((Map<String, Object>) value);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> objectMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }
}
