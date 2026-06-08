package org.realtimemail;

import java.util.HashSet;
import java.util.Set;

public final class TrustPolicy {
  private final Set<String> trustedDomains = new HashSet<>();

  public void trustDomain(String domain) {
    trustedDomains.add(domain);
  }

  public void revokeDomain(String domain) {
    trustedDomains.remove(domain);
  }

  public boolean isTrusted(String domain) {
    return trustedDomains.contains(domain);
  }

  public boolean canRender(RealtimeMailMessage message) {
    if (message.source() == MailSource.TRADITIONAL) {
      return message.capabilities().contains(TrustCapability.RENDER_HTML);
    }
    return isTrusted(message.domain()) && message.capabilities().contains(TrustCapability.RENDER_HTML);
  }

  public boolean canRunScript(RealtimeMailMessage message) {
    return message.source() == MailSource.REALTIME
      && isTrusted(message.domain())
      && message.capabilities().contains(TrustCapability.RUN_SCRIPT_SANDBOXED);
  }
}
