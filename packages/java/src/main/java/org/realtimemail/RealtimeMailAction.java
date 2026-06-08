package org.realtimemail;

import java.util.Optional;

public record RealtimeMailAction(
  String id,
  String messageId,
  String domain,
  RealtimeMailActionType type,
  boolean requiresUserGesture,
  Optional<String> url,
  Optional<Object> payload
) {}
