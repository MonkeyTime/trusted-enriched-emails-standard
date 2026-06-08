package org.realtimemail;

import java.util.Optional;

public final class ActionReceiver {
  private final String domain;

  public ActionReceiver(String domain) {
    this.domain = domain;
  }

  public GatewayActionDecision receive(RealtimeMailAction action) {
    if (!new ActionValidator().validate(action).isEmpty()) {
      return new GatewayActionDecision(false, "invalid_action", Optional.empty());
    }
    if (!action.domain().equals(domain)) {
      return new GatewayActionDecision(false, "domain_not_allowed", Optional.empty());
    }
    return new GatewayActionDecision(true, "ok", Optional.of(action));
  }
}
