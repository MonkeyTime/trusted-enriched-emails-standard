package org.realtimemail;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public record RealtimeMailMessage(
  String id,
  MailSource source,
  String domain,
  Optional<String> channelId,
  String from,
  String subject,
  String html,
  Optional<String> css,
  Optional<String> script,
  List<TrustCapability> capabilities,
  Instant receivedAt,
  Optional<Instant> expiresAt,
  Optional<String> signature
) {}
