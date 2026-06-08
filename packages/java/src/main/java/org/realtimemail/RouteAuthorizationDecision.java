package org.realtimemail;

import java.util.Optional;

public record RouteAuthorizationDecision(boolean ok, String reason, Optional<RealtimeMailChannel> channel) {}
