package org.realtimemail;

import java.util.List;

public final class ValidationException extends RuntimeException {
  private final List<ValidationIssue> issues;

  public ValidationException(List<ValidationIssue> issues) {
    super(String.join("; ", issues.stream().map(issue -> issue.path() + ": " + issue.message()).toList()));
    this.issues = issues;
  }

  public List<ValidationIssue> issues() {
    return issues;
  }
}
