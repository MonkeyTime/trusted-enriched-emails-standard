namespace RealtimeMail;

public sealed class ManifestResolver
{
    private readonly HttpClient httpClient;

    public ManifestResolver(HttpClient? httpClient = null)
    {
        this.httpClient = httpClient ?? new HttpClient();
    }

    public Uri ManifestUri(string domain)
    {
        return new Uri($"https://{domain}/.well-known/realtime-mail.json");
    }

    public Task<string> ResolveJsonAsync(string domain, CancellationToken cancellationToken = default)
    {
        return httpClient.GetStringAsync(ManifestUri(domain), cancellationToken);
    }
}
