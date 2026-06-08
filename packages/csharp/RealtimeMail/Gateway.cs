namespace RealtimeMail;

public interface ISubscription : IAsyncDisposable
{
    string Route { get; }
}

public interface IGatewayTransport
{
    Task<ISubscription> SubscribeAsync(
        string route,
        Action<RealtimeMailMessage> onMessage,
        CancellationToken cancellationToken = default
    );

    Task PublishAsync(string route, object payload, CancellationToken cancellationToken = default);
}

public sealed class RealtimeGatewayClient
{
    private readonly IGatewayTransport transport;

    public RealtimeGatewayClient(IGatewayTransport transport)
    {
        this.transport = transport;
    }

    public Task<ISubscription> SubscribeAsync(
        RealtimeMailChannel channel,
        Action<RealtimeMailMessage> onMessage,
        CancellationToken cancellationToken = default
    )
    {
        return transport.SubscribeAsync(channel.Route, onMessage, cancellationToken);
    }

    public Task PublishActionAsync(string route, object payload, CancellationToken cancellationToken = default)
    {
        return transport.PublishAsync(route, payload, cancellationToken);
    }
}
