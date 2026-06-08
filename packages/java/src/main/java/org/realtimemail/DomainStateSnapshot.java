package org.realtimemail;

import java.util.Set;

public record DomainStateSnapshot(
  Set<String> trustedDomains,
  Set<String> mutedDomains,
  Set<String> revokedDomains
) {}
