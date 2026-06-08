package org.realtimemail;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public final class SignatureVerifier {
  public boolean verifyEd25519(RealtimeMailMessage message, String publicKey) {
    try {
      if (message.signature().isEmpty() || !publicKey.startsWith("ed25519:")) {
        return false;
      }
      var keyBytes = Base64.getUrlDecoder().decode(publicKey.substring("ed25519:".length()));
      var signatureBytes = decodeSignature(message.signature().get());
      var keyFactory = KeyFactory.getInstance("Ed25519");
      var keySpec = new X509EncodedKeySpec(wrapEd25519RawKey(keyBytes));
      var key = keyFactory.generatePublic(keySpec);
      var verifier = Signature.getInstance("Ed25519");
      verifier.initVerify(key);
      verifier.update(canonicalMessage(message).getBytes(StandardCharsets.UTF_8));
      return verifier.verify(signatureBytes);
    } catch (Exception _error) {
      return false;
    }
  }

  public String canonicalMessage(RealtimeMailMessage message) {
    var builder = new StringBuilder();
    builder.append("{");
    appendCapabilities(builder, message);
    message.channelId().ifPresent(value -> append(builder, "channelId", value));
    message.css().ifPresent(value -> append(builder, "css", value));
    append(builder, "domain", message.domain());
    append(builder, "from", message.from());
    append(builder, "html", message.html());
    append(builder, "id", message.id());
    append(builder, "receivedAt", DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC).format(message.receivedAt()));
    message.expiresAt().ifPresent(value -> append(builder, "expiresAt", DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC).format(value)));
    message.script().ifPresent(value -> append(builder, "script", value));
    append(builder, "source", message.source() == MailSource.REALTIME ? "realtime" : "traditional");
    append(builder, "subject", message.subject());
    if (builder.charAt(builder.length() - 1) == ',') {
      builder.deleteCharAt(builder.length() - 1);
    }
    builder.append("}");
    return builder.toString();
  }

  private static void appendCapabilities(StringBuilder builder, RealtimeMailMessage message) {
    builder.append("\"capabilities\":[");
    for (var capability : message.capabilities()) {
      builder.append("\"").append(capabilityValue(capability)).append("\",");
    }
    if (!message.capabilities().isEmpty()) {
      builder.deleteCharAt(builder.length() - 1);
    }
    builder.append("],");
  }

  private static void append(StringBuilder builder, String key, String value) {
    builder.append("\"").append(key).append("\":\"").append(escapeJson(value)).append("\",");
  }

  private static String capabilityValue(TrustCapability capability) {
    return switch (capability) {
      case RENDER_HTML -> "render:html";
      case RENDER_CSS -> "render:css";
      case RENDER_SVG -> "render:svg";
      case RUN_SCRIPT_SANDBOXED -> "run:script-sandboxed";
      case OPEN_URL_USER_GESTURE -> "open-url:user-gesture";
      case PAYMENT_REQUEST_USER_GESTURE -> "payment-request:user-gesture";
      case STORAGE_ISOLATED -> "storage:isolated";
      case NETWORK_DOMAIN_ONLY -> "network:domain-only";
    };
  }

  private static String escapeJson(String value) {
    return value
      .replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\n", "\\n")
      .replace("\r", "\\r")
      .replace("\t", "\\t");
  }

  private static byte[] decodeSignature(String signature) {
    var value = signature.startsWith("rmail1.") ? signature.split("\\.")[2] : signature.replaceFirst("^ed25519:", "");
    return Base64.getUrlDecoder().decode(value);
  }

  private static byte[] wrapEd25519RawKey(byte[] rawKey) {
    var prefix = new byte[] { 0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00 };
    var wrapped = new byte[prefix.length + rawKey.length];
    System.arraycopy(prefix, 0, wrapped, 0, prefix.length);
    System.arraycopy(rawKey, 0, wrapped, prefix.length, rawKey.length);
    return wrapped;
  }
}
