package org.realtimemail;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

public final class RealtimeMessageBuilder {
  private final RealtimeMailManifest manifest;
  private final Supplier<Instant> clock;

  public RealtimeMessageBuilder(RealtimeMailManifest manifest, Supplier<Instant> clock) {
    this.manifest = manifest;
    this.clock = clock;
  }

  public RealtimeMailMessage build(
    String channelId,
    String from,
    String subject,
    String html,
    Optional<String> css,
    Optional<String> script,
    Optional<Instant> expiresAt,
    Optional<String> id
  ) {
    var channel = manifest.channels().stream()
      .filter(candidate -> candidate.id().equals(channelId))
      .findFirst()
      .orElseThrow(() -> new IllegalArgumentException("Unknown channel: " + channelId));
    var message = new RealtimeMailMessage(
      id.orElseGet(() -> UUID.randomUUID().toString()),
      MailSource.REALTIME,
      manifest.domain(),
      Optional.of(channel.id()),
      from,
      subject,
      html,
      css,
      script,
      channel.capabilities(),
      clock.get(),
      expiresAt,
      Optional.empty()
    );
    var validationMessage = new RealtimeMailMessage(
      message.id(),
      message.source(),
      message.domain(),
      message.channelId(),
      message.from(),
      message.subject(),
      message.html(),
      message.css(),
      message.script(),
      message.capabilities(),
      message.receivedAt(),
      message.expiresAt(),
      Optional.of("unsigned-builder-placeholder")
    );
    new MessageValidator().parse(validationMessage);
    return message;
  }
}
