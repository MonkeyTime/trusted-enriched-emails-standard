package org.realtimemail;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
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
}
