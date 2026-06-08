package org.realtimemail;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class PaymentRequestPayloadValidator {
  private static final Pattern DOMAIN = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$");

  public List<ValidationIssue> validate(Map<String, Object> payload) {
    var issues = new ArrayList<ValidationIssue>();
    if (!"host-mediated-payment-request".equals(payload.get("kind"))) issues.add(new ValidationIssue("$.kind", "must equal host-mediated-payment-request"));
    if (!(payload.get("invoiceId") instanceof String invoiceId) || invoiceId.isBlank()) issues.add(new ValidationIssue("$.invoiceId", "must be a string"));
    var merchant = objectMap(payload.get("merchant"));
    if (merchant == null) {
      issues.add(new ValidationIssue("$.merchant", "must be an object"));
    } else {
      if (!(merchant.get("domain") instanceof String domain) || !DOMAIN.matcher(domain).matches()) issues.add(new ValidationIssue("$.merchant.domain", "must be a valid domain"));
      if (!(merchant.get("displayName") instanceof String displayName) || displayName.isBlank()) issues.add(new ValidationIssue("$.merchant.displayName", "must be a string"));
    }
    var amount = objectMap(payload.get("amount"));
    if (amount == null) {
      issues.add(new ValidationIssue("$.amount", "must be an object"));
    } else {
      if (!(amount.get("value") instanceof String value) || value.isBlank()) issues.add(new ValidationIssue("$.amount.value", "must be a string"));
      if (!(amount.get("currency") instanceof String currency) || currency.isBlank()) issues.add(new ValidationIssue("$.amount.currency", "must be a string"));
    }
    if (!(payload.get("description") instanceof String description) || description.isBlank()) issues.add(new ValidationIssue("$.description", "must be a string"));
    if (!(payload.get("confirmationUx") instanceof String ux) || !List.of("browser_payment_request", "host_confirmation", "provider_checkout", "qr_code").contains(ux)) {
      issues.add(new ValidationIssue("$.confirmationUx", "must be a supported confirmation UX"));
    }
    var fallback = objectMap(payload.get("fallbackProvider"));
    if (fallback != null) {
      if (!(fallback.get("type") instanceof String type) || !List.of("provider_checkout", "qr_code").contains(type)) {
        issues.add(new ValidationIssue("$.fallbackProvider.type", "must be a supported fallback provider type"));
      }
      if (!(fallback.get("label") instanceof String label) || label.isBlank()) issues.add(new ValidationIssue("$.fallbackProvider.label", "must be a string"));
      if (merchant != null && merchant.get("domain") instanceof String merchantDomain) {
        validateFallbackDomain(fallback.get("url"), merchantDomain, "$.fallbackProvider.url", issues);
        validateFallbackDomain(fallback.get("qrPayload"), merchantDomain, "$.fallbackProvider.qrPayload", issues);
      }
    }
    if (!(payload.get("expiresAt") instanceof String expiresAt) || expiresAt.isBlank()) issues.add(new ValidationIssue("$.expiresAt", "must be a string"));
    return issues;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> objectMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  private static void validateFallbackDomain(Object value, String merchantDomain, String path, List<ValidationIssue> issues) {
    try {
      if (!(value instanceof String text) || !text.startsWith("https://")) return;
      if (!merchantDomain.equals(URI.create(text).getHost())) issues.add(new ValidationIssue(path, "must stay on the merchant domain"));
    } catch (Exception _error) {
      issues.add(new ValidationIssue(path, "must stay on the merchant domain"));
    }
  }
}
