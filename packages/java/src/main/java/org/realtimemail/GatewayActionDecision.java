package org.realtimemail;

import java.util.Optional;

public record GatewayActionDecision(boolean ok, String reason, Optional<RealtimeMailAction> action) {}
