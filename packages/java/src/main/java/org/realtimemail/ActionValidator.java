package org.realtimemail;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

public final class ActionValidator {
  private static final Pattern DOMAIN = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$");
  private static final Pattern ID = Pattern.compile("^[a-z0-9][a-z0-9._-]{0,63}$");

  public List<ValidationIssue> validate(RealtimeMailAction action) {
    var issues = new ArrayList<ValidationIssue>();
    if (action.id() == null || !ID.matcher(action.id()).matches()) issues.add(new ValidationIssue("$.id", "must be a valid action id"));
    if (action.messageId() == null || action.messageId().isBlank()) issues.add(new ValidationIssue("$.messageId", "must be set"));
    if (action.domain() == null || !DOMAIN.matcher(action.domain()).matches()) issues.add(new ValidationIssue("$.domain", "must be a valid domain"));
    if (!action.requiresUserGesture()) issues.add(new ValidationIssue("$.requiresUserGesture", "must be true"));
    if (action.type() == RealtimeMailActionType.OPEN_URL && !isHttpsUrlForDomain(action.url(), action.domain())) {
      issues.add(new ValidationIssue("$.url", "must be an https URL for the action domain"));
    }
    if (paymentPayload(action.payload()).isPresent()) {
      var payload = paymentPayload(action.payload()).get();
      for (var issue : new PaymentRequestPayloadValidator().validate(payload)) {
        issues.add(new ValidationIssue("$.payload" + issue.path().substring(1), issue.message()));
      }
      if (action.type() != RealtimeMailActionType.PUBLISH_GATEWAY_EVENT) {
        issues.add(new ValidationIssue("$.type", "must be publish_gateway_event for payment requests"));
      }
      if (payload.get("merchant") instanceof Map<?, ?> merchant && !action.domain().equals(merchant.get("domain"))) {
        issues.add(new ValidationIssue("$.payload.merchant.domain", "must match action domain"));
      }
    }
    return issues;
  }

  public RealtimeMailAction parse(RealtimeMailAction action) {
    var issues = validate(action);
    if (!issues.isEmpty()) throw new ValidationException(issues);
    return action;
  }

  private static boolean isHttpsUrlForDomain(Optional<String> value, String domain) {
    try {
      if (value.isEmpty()) return false;
      var uri = URI.create(value.get());
      return "https".equals(uri.getScheme()) && domain.equals(uri.getHost());
    } catch (Exception _error) {
      return false;
    }
  }

  @SuppressWarnings("unchecked")
  private static Optional<Map<String, Object>> paymentPayload(Optional<Object> payload) {
    if (payload.isEmpty() || !(payload.get() instanceof Map<?, ?> value)) return Optional.empty();
    if (!"host-mediated-payment-request".equals(value.get("kind"))) return Optional.empty();
    return Optional.of((Map<String, Object>) value);
  }
}
