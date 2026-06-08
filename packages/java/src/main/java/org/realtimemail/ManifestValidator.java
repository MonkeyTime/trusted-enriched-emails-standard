package org.realtimemail;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public final class ManifestValidator {
  private static final Pattern DOMAIN = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$");
  private static final Pattern KEY = Pattern.compile("^(ed25519|ecdsa-p256):[A-Za-z0-9_-]+={0,2}$");

  public List<ValidationIssue> validate(RealtimeMailManifest manifest) {
    var issues = new ArrayList<ValidationIssue>();
    if (!"realtime-mail".equals(manifest.protocol())) {
      issues.add(new ValidationIssue("$.protocol", "must equal realtime-mail"));
    }
    if (isBlank(manifest.version())) {
      issues.add(new ValidationIssue("$.version", "must be set"));
    }
    if (isBlank(manifest.domain()) || !DOMAIN.matcher(manifest.domain()).matches()) {
      issues.add(new ValidationIssue("$.domain", "must be a valid domain"));
    }
    if (isBlank(manifest.displayName())) {
      issues.add(new ValidationIssue("$.displayName", "must be set"));
    }
    if (manifest.publicKeys() == null || manifest.publicKeys().isEmpty()) {
      issues.add(new ValidationIssue("$.publicKeys", "must be non-empty"));
    } else {
      for (int i = 0; i < manifest.publicKeys().size(); i++) {
        if (!KEY.matcher(manifest.publicKeys().get(i)).matches()) {
          issues.add(new ValidationIssue("$.publicKeys[" + i + "]", "must be a supported public key"));
        }
      }
    }
    if (manifest.channels() == null || manifest.channels().isEmpty()) {
      issues.add(new ValidationIssue("$.channels", "must be non-empty"));
    }
    return issues;
  }

  public RealtimeMailManifest parse(RealtimeMailManifest manifest) {
    var issues = validate(manifest);
    if (!issues.isEmpty()) {
      throw new ValidationException(issues);
    }
    return manifest;
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
