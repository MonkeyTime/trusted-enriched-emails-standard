package org.realtimemail;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public final class MessageValidator {
  private static final Pattern DOMAIN = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$");

  public List<ValidationIssue> validate(RealtimeMailMessage message) {
    var issues = new ArrayList<ValidationIssue>();
    if (isBlank(message.id())) issues.add(new ValidationIssue("$.id", "must be set"));
    if (message.source() == null) issues.add(new ValidationIssue("$.source", "must be set"));
    if (isBlank(message.domain()) || !DOMAIN.matcher(message.domain()).matches()) issues.add(new ValidationIssue("$.domain", "must be valid"));
    if (isBlank(message.from())) issues.add(new ValidationIssue("$.from", "must be set"));
    if (message.html() == null || message.html().isBlank()) issues.add(new ValidationIssue("$.html", "must be set"));
    if (message.capabilities() == null) issues.add(new ValidationIssue("$.capabilities", "must be set"));
    if (message.receivedAt() == null) issues.add(new ValidationIssue("$.receivedAt", "must be set"));

    if (message.source() == MailSource.REALTIME) {
      if (message.channelId().isEmpty()) issues.add(new ValidationIssue("$.channelId", "is required for realtime messages"));
      if (message.signature().isEmpty()) issues.add(new ValidationIssue("$.signature", "is required for realtime messages"));
    }
    if (message.script().isPresent() && !message.capabilities().contains(TrustCapability.RUN_SCRIPT_SANDBOXED)) {
      issues.add(new ValidationIssue("$.capabilities", "must include RUN_SCRIPT_SANDBOXED when script is present"));
    }
    return issues;
  }

  public RealtimeMailMessage parse(RealtimeMailMessage message) {
    var issues = validate(message);
    if (!issues.isEmpty()) {
      throw new ValidationException(issues);
    }
    return message;
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
