package org.realtimemail;

import java.util.List;

public record RealtimeMailManifest(
  String protocol,
  String version,
  String domain,
  String displayName,
  List<String> publicKeys,
  List<RealtimeMailChannel> channels
) {}
