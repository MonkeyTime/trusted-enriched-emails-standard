package org.realtimemail;

public record TraditionalMailAccount(
  String id,
  String email,
  String provider,
  String incomingHost,
  String outgoingHost
) {}
