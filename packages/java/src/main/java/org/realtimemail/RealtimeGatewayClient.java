package org.realtimemail;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class RealtimeGatewayClient {
  private final GatewayTransport transport;

  public RealtimeGatewayClient(GatewayTransport transport) {
    this.transport = transport;
  }

  public CompletableFuture<Subscription> subscribe(
    RealtimeMailChannel channel,
    Consumer<RealtimeMailMessage> onMessage
  ) {
    return transport.subscribe(channel.route(), onMessage);
  }

  public CompletableFuture<Void> publishAction(String route, Object payload) {
    return transport.publish(route, payload);
  }
}
