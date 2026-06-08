package org.realtimemail;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

public record MessageStateSnapshot(
  Set<String> dismissedMessageIds,
  Set<String> deletedMessageIds,
  Set<String> supersededMessageIds,
  Optional<Instant> now
) {}
