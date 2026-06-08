using System.Text.RegularExpressions;

namespace RealtimeMail;

public sealed class ManifestResolver
{
    private static readonly Regex DomainPattern = new("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", RegexOptions.Compiled);
    private readonly HttpClient httpClient;

    public ManifestResolver(HttpClient? httpClient = null)
    {
        this.httpClient = httpClient ?? new HttpClient();
    }

    public Uri ManifestUri(string domain)
    {
        if (!DomainPattern.IsMatch(domain))
        {
            throw new RealtimeMailValidationException(new[] { new ValidationIssue("$.domain", "must be a valid domain") });
        }
        return new Uri($"https://{domain}/.well-known/realtime-mail.json");
    }

    public Task<string> ResolveJsonAsync(string domain, CancellationToken cancellationToken = default)
    {
        return httpClient.GetStringAsync(ManifestUri(domain), cancellationToken);
    }
}
