namespace RealtimeMail;

public sealed class RealtimeMailClient
{
    public RealtimeMailClient(
        ManifestResolver manifests,
        TrustPolicy trust,
        RealtimeGatewayClient gateway,
        TraditionalMailAccountManager accounts
    )
    {
        Manifests = manifests;
        Trust = trust;
        Gateway = gateway;
        Accounts = accounts;
    }

    public ManifestResolver Manifests { get; }

    public TrustPolicy Trust { get; }

    public RealtimeGatewayClient Gateway { get; }

    public TraditionalMailAccountManager Accounts { get; }

    public Task<string> DiscoverAsync(string domain, CancellationToken cancellationToken = default)
    {
        return Manifests.ResolveJsonAsync(domain, cancellationToken);
    }

    public void TrustDomain(string domain)
    {
        Trust.TrustDomain(domain);
    }

    public Task<ISubscription> SubscribeAsync(
        RealtimeMailChannel channel,
        Action<RealtimeMailMessage> onMessage,
        CancellationToken cancellationToken = default
    )
    {
        return Gateway.SubscribeAsync(channel, onMessage, cancellationToken);
    }
}
