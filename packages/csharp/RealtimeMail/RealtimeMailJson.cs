using System.Text.Json;
using System.Text.Json.Serialization;

namespace RealtimeMail;

public static class RealtimeMailJson
{
    public static readonly JsonSerializerOptions Options = CreateOptions();

    public static RealtimeMailManifest DeserializeManifest(string json)
    {
        return JsonSerializer.Deserialize<RealtimeMailManifest>(json, Options)
            ?? throw new JsonException("Manifest JSON produced null");
    }

    public static RealtimeMailMessage DeserializeMessage(string json)
    {
        return JsonSerializer.Deserialize<RealtimeMailMessage>(json, Options)
            ?? throw new JsonException("Message JSON produced null");
    }

    public static RealtimeMailAction DeserializeAction(string json)
    {
        return JsonSerializer.Deserialize<RealtimeMailAction>(json, Options)
            ?? throw new JsonException("Action JSON produced null");
    }

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
        };
        options.Converters.Add(new TrustCapabilityJsonConverter());
        options.Converters.Add(new MailSourceJsonConverter());
        options.Converters.Add(new RealtimeMailActionTypeJsonConverter());
        return options;
    }
}

public sealed class RealtimeMailActionTypeJsonConverter : JsonConverter<RealtimeMailActionType>
{
    public override RealtimeMailActionType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.GetString() switch
        {
            "open_url" => RealtimeMailActionType.OpenUrl,
            "publish_gateway_event" => RealtimeMailActionType.PublishGatewayEvent,
            "request_notification" => RealtimeMailActionType.RequestNotification,
            "store_isolated_value" => RealtimeMailActionType.StoreIsolatedValue,
            _ => throw new JsonException("Unsupported action type")
        };
    }

    public override void Write(Utf8JsonWriter writer, RealtimeMailActionType value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            RealtimeMailActionType.OpenUrl => "open_url",
            RealtimeMailActionType.PublishGatewayEvent => "publish_gateway_event",
            RealtimeMailActionType.RequestNotification => "request_notification",
            RealtimeMailActionType.StoreIsolatedValue => "store_isolated_value",
            _ => throw new JsonException("Unsupported action type")
        });
    }
}

public sealed class TrustCapabilityJsonConverter : JsonConverter<TrustCapability>
{
    public override TrustCapability Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.GetString() switch
        {
            "render:html" => TrustCapability.RenderHtml,
            "render:css" => TrustCapability.RenderCss,
            "render:svg" => TrustCapability.RenderSvg,
            "run:script-sandboxed" => TrustCapability.RunScriptSandboxed,
            "open-url:user-gesture" => TrustCapability.OpenUrlUserGesture,
            "payment-request:user-gesture" => TrustCapability.PaymentRequestUserGesture,
            "storage:isolated" => TrustCapability.StorageIsolated,
            "network:domain-only" => TrustCapability.NetworkDomainOnly,
            _ => throw new JsonException("Unsupported trust capability")
        };
    }

    public override void Write(Utf8JsonWriter writer, TrustCapability value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            TrustCapability.RenderHtml => "render:html",
            TrustCapability.RenderCss => "render:css",
            TrustCapability.RenderSvg => "render:svg",
            TrustCapability.RunScriptSandboxed => "run:script-sandboxed",
            TrustCapability.OpenUrlUserGesture => "open-url:user-gesture",
            TrustCapability.PaymentRequestUserGesture => "payment-request:user-gesture",
            TrustCapability.StorageIsolated => "storage:isolated",
            TrustCapability.NetworkDomainOnly => "network:domain-only",
            _ => throw new JsonException("Unsupported trust capability")
        });
    }
}

public sealed class MailSourceJsonConverter : JsonConverter<MailSource>
{
    public override MailSource Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.GetString() switch
        {
            "traditional" => MailSource.Traditional,
            "realtime" => MailSource.Realtime,
            _ => throw new JsonException("Unsupported mail source")
        };
    }

    public override void Write(Utf8JsonWriter writer, MailSource value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            MailSource.Traditional => "traditional",
            MailSource.Realtime => "realtime",
            _ => throw new JsonException("Unsupported mail source")
        });
    }
}
