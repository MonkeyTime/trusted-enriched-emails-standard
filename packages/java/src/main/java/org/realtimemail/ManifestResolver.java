package org.realtimemail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

public final class ManifestResolver {
  private static final Pattern DOMAIN = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$");
  private final HttpClient httpClient;

  public ManifestResolver() {
    this(HttpClient.newHttpClient());
  }

  public ManifestResolver(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public URI manifestUri(String domain) {
    if (domain == null || !DOMAIN.matcher(domain).matches()) {
      throw new ValidationException(List.of(new ValidationIssue("$.domain", "must be a valid domain")));
    }
    return URI.create("https://" + domain + "/.well-known/realtime-mail.json");
  }

  public CompletableFuture<String> resolveJson(String domain) {
    var request = HttpRequest.newBuilder(manifestUri(domain)).GET().build();
    return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
      .thenApply(HttpResponse::body);
  }
}
