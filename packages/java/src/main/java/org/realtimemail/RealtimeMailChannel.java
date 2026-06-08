package org.realtimemail;

import java.util.List;

public record RealtimeMailChannel(
  String id,
  String label,
  String route,
  String description,
  List<TrustCapability> capabilities
) {}
