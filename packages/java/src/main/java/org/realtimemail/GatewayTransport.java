package org.realtimemail;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public interface GatewayTransport {
  CompletableFuture<Subscription> subscribe(String route, Consumer<RealtimeMailMessage> onMessage);

  CompletableFuture<Void> publish(String route, Object payload);
}
