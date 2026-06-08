package org.realtimemail;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class RealtimeMailClient {
  private final ManifestResolver manifests;
  private final TrustPolicy trust;
  private final RealtimeGatewayClient gateway;
  private final TraditionalMailAccountManager accounts;

  public RealtimeMailClient(
    ManifestResolver manifests,
    TrustPolicy trust,
    RealtimeGatewayClient gateway,
    TraditionalMailAccountManager accounts
  ) {
    this.manifests = manifests;
    this.trust = trust;
    this.gateway = gateway;
    this.accounts = accounts;
  }

  public CompletableFuture<String> discover(String domain) {
    return manifests.resolveJson(domain);
  }

  public void trustDomain(String domain) {
    trust.trustDomain(domain);
  }

  public CompletableFuture<Subscription> subscribe(
    RealtimeMailChannel channel,
    Consumer<RealtimeMailMessage> onMessage
  ) {
    return gateway.subscribe(channel, onMessage);
  }

  public TraditionalMailAccountManager accounts() {
    return accounts;
  }
}
