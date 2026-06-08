package org.realtimemail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;

public final class ManifestResolver {
  private final HttpClient httpClient;

  public ManifestResolver() {
    this(HttpClient.newHttpClient());
  }

  public ManifestResolver(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public URI manifestUri(String domain) {
    return URI.create("https://" + domain + "/.well-known/realtime-mail.json");
  }

  public CompletableFuture<String> resolveJson(String domain) {
    var request = HttpRequest.newBuilder(manifestUri(domain)).GET().build();
    return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
      .thenApply(HttpResponse::body);
  }
}
