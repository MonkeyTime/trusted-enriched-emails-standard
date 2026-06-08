package org.realtimemail;

import java.util.Arrays;
import java.util.Optional;

public final class RouteAuthorizer {
  private final RealtimeMailManifest manifest;

  public RouteAuthorizer(RealtimeMailManifest manifest) {
    this.manifest = manifest;
  }

  public RouteAuthorizationDecision authorize(String route, Optional<String> channelId, Optional<String> userId) {
    for (var channel : manifest.channels()) {
      if (channelId.isPresent() && !channel.id().equals(channelId.get())) continue;
      if (routeMatches(channel.route(), route, userId)) {
        return new RouteAuthorizationDecision(true, "ok", Optional.of(channel));
      }
    }
    return new RouteAuthorizationDecision(false, "route_not_allowed", Optional.empty());
  }

  private static boolean routeMatches(String pattern, String route, Optional<String> userId) {
    var patternParts = Arrays.stream(pattern.split("/")).filter(part -> !part.isBlank()).toList();
    var routeParts = Arrays.stream(route.split("/")).filter(part -> !part.isBlank()).toList();
    if (patternParts.size() != routeParts.size()) return false;
    for (var index = 0; index < patternParts.size(); index++) {
      var patternPart = patternParts.get(index);
      var routePart = routeParts.get(index);
      if (patternPart.equals(":userId")) {
        if (userId.isEmpty() || !routePart.equals(userId.get())) return false;
      } else if (!patternPart.startsWith(":") && !patternPart.equals(routePart)) {
        return false;
      }
    }
    return true;
  }
}
