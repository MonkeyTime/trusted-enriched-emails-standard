package org.realtimemail;

import java.util.concurrent.CompletableFuture;

public interface Subscription {
  String route();

  CompletableFuture<Void> close();
}
