package org.realtimemail;

import java.util.Optional;

public record HostActionDecision(boolean ok, String reason, Optional<RealtimeMailAction> action) {}
