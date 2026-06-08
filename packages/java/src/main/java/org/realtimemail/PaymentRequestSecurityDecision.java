package org.realtimemail;

import java.util.Map;
import java.util.Optional;

public record PaymentRequestSecurityDecision(boolean ok, String reason, Optional<Map<String, Object>> payload) {}
