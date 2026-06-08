using RealtimeMail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var root = FindRepositoryRoot();
var cases = new[]
{
    new TestCase("conformance/valid-manifest.acme.json", true, true),
    new TestCase("conformance/invalid-manifest.missing-keys.json", true, false),
    new TestCase("conformance/invalid-manifest.unknown-channel-property.json", true, false),
    new TestCase("conformance/valid-message.invoice.json", false, true),
    new TestCase("conformance/invalid-message.script-without-capability.json", false, false),
    new TestCase("conformance/invalid-message.unknown-property.json", false, false)
};
var actionCases = new[]
{
    new TestCase("conformance/valid-action.open-url.json", false, true),
    new TestCase("conformance/invalid-action.no-user-gesture.json", false, false),
    new TestCase("conformance/invalid-action.cross-domain-url.json", false, false)
};

var failures = 0;

foreach (var testCase in cases)
{
    var path = Path.Combine(root, testCase.File.Replace('/', Path.DirectorySeparatorChar));
    var json = File.ReadAllText(path);
    IReadOnlyList<ValidationIssue> issues;
    try
    {
        issues = testCase.Manifest
            ? new ManifestValidator().Validate(RealtimeMailJson.DeserializeManifest(json))
            : new MessageValidator().Validate(RealtimeMailJson.DeserializeMessage(json));
    }
    catch (JsonException) when (!testCase.Valid)
    {
        Console.WriteLine($"PASS {testCase.File}");
        continue;
    }

    if (testCase.Valid && issues.Count > 0)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {testCase.File}: {string.Join("; ", issues.Select(issue => $"{issue.Path}: {issue.Message}"))}");
    }
    else if (!testCase.Valid && issues.Count == 0)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {testCase.File}: expected validation failure");
    }
    else
    {
        Console.WriteLine($"PASS {testCase.File}");
    }
}

foreach (var testCase in actionCases)
{
    var path = Path.Combine(root, testCase.File.Replace('/', Path.DirectorySeparatorChar));
    IReadOnlyList<ValidationIssue> issues;
    try
    {
        issues = new ActionValidator().Validate(RealtimeMailJson.DeserializeAction(File.ReadAllText(path)));
    }
    catch (JsonException) when (!testCase.Valid)
    {
        Console.WriteLine($"PASS {testCase.File}");
        continue;
    }
    if (testCase.Valid && issues.Count > 0)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {testCase.File}: {string.Join("; ", issues.Select(issue => $"{issue.Path}: {issue.Message}"))}");
    }
    else if (!testCase.Valid && issues.Count == 0)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {testCase.File}: expected validation failure");
    }
    else
    {
        Console.WriteLine($"PASS {testCase.File}");
    }
}

if (!VerifyEcdsaSignature())
{
    failures++;
    Console.Error.WriteLine("FAIL C# ECDSA P-256 signature verification");
}
else
{
    Console.WriteLine("PASS C# ECDSA P-256 signature verification");
}

if (!VerifyGatewayProfile())
{
    failures++;
    Console.Error.WriteLine("FAIL C# gateway profile security gates");
}
else
{
    Console.WriteLine("PASS C# gateway profile security gates");
}

return failures == 0 ? 0 : 1;

static string FindRepositoryRoot()
{
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null)
    {
        if (Directory.Exists(Path.Combine(directory.FullName, "conformance")))
        {
            return directory.FullName;
        }
        directory = directory.Parent;
    }
    throw new DirectoryNotFoundException("Could not locate repository root");
}

static bool VerifyEcdsaSignature()
{
    using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    var message = new RealtimeMailMessage(
        "crypto-vector-001",
        MailSource.Realtime,
        "billing.acme.tld",
        "invoice-events",
        "billing@acme.tld",
        "Signed message",
        "<article><h1>Signed</h1></article>",
        "body { font-family: sans-serif; }",
        null,
        new[] { TrustCapability.RenderHtml, TrustCapability.RenderCss },
        DateTimeOffset.Parse("2026-06-08T08:00:00Z"),
        null,
        null
    );
    var verifier = new SignatureVerifier();
    var signature = ecdsa.SignData(Encoding.UTF8.GetBytes(verifier.CanonicalMessage(message)), HashAlgorithmName.SHA256);
    var signed = message with
    {
        Signature = "rmail1.eyJhbGciOiJFUzI1NiIsInR5cCI6InJtYWlsMSJ9." + Base64Url(signature)
    };
    var publicKey = "ecdsa-p256:" + Base64Url(ecdsa.ExportSubjectPublicKeyInfo());
    if (!verifier.VerifyEcdsaP256(signed, publicKey))
    {
        return false;
    }
    return !verifier.VerifyEcdsaP256(signed with { Subject = "Tampered" }, publicKey);
}

static bool VerifyGatewayProfile()
{
    using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    var publicKey = "ecdsa-p256:" + Base64Url(ecdsa.ExportSubjectPublicKeyInfo());
    var manifest = new RealtimeMailManifest(
        "realtime-mail",
        "0.1-draft",
        "billing.acme.tld",
        "ACME Billing",
        new[] { publicKey },
        new[]
        {
            new RealtimeMailChannel(
                "invoice-events",
                "Invoices",
                "/rt/invoices/:userId",
                null,
                new[] { TrustCapability.RenderHtml, TrustCapability.RenderCss, TrustCapability.OpenUrlUserGesture }
            )
        }
    );
    var builder = new RealtimeMessageBuilder(manifest, () => DateTimeOffset.Parse("2026-06-08T08:00:00Z"));
    var message = builder.Build(
        "invoice-events",
        "billing@acme.tld",
        "Action test",
        "<a>Open</a>",
        expiresAt: DateTimeOffset.Parse("2026-06-08T08:15:00Z"),
        id: "host-action-001"
    );
    message = new MessageSigner().SignEcdsaP256(message, ecdsa);
    var action = new RealtimeMailAction(
        "open-invoice",
        message.Id,
        message.Domain,
        RealtimeMailActionType.OpenUrl,
        true,
        "https://billing.acme.tld/invoices/1",
        null
    );
    var trust = new TrustPolicy();
    trust.TrustDomain("billing.acme.tld");
    var broker = new HostActionBroker(trust);
    if (!broker.Authorize(action, message, manifest, true, DateTimeOffset.Parse("2026-06-08T08:01:00Z")).Ok) return false;
    if (broker.Authorize(action, message, manifest, false, DateTimeOffset.Parse("2026-06-08T08:01:00Z")).Ok) return false;
    if (broker.Authorize(action, message, manifest, true, DateTimeOffset.Parse("2026-06-08T08:16:00Z")).Ok) return false;
    if (!new RouteAuthorizer(manifest).Authorize("/rt/invoices/demo-user", "invoice-events", "demo-user").Ok) return false;
    if (new RouteAuthorizer(manifest).Authorize("/rt/admin/demo-user", "invoice-events", "demo-user").Ok) return false;
    var unsafePlaceholderManifest = manifest with
    {
        Channels = new[]
        {
            new RealtimeMailChannel("invoice-events", "Invoices", "/rt/invoices/:accountId", null, new[] { TrustCapability.RenderHtml })
        }
    };
    if (new RouteAuthorizer(unsafePlaceholderManifest).Authorize("/rt/invoices/other-user", "invoice-events", "demo-user").Ok) return false;
    if (!Throws(() => new ManifestResolver().ManifestUri("billing.acme.tld@127.0.0.1"))) return false;
    if (!new ActionReceiver("billing.acme.tld").Receive(action).Ok) return false;
    var crossDomain = action with { Domain = "evil.example", Url = "https://evil.example/invoices/1" };
    if (new ActionReceiver("billing.acme.tld").Receive(crossDomain).Ok) return false;

    var statePolicy = new StatePolicy();
    if (statePolicy.EvaluateDomainState("billing.acme.tld", new DomainStateSnapshot(
        new HashSet<string> { "billing.acme.tld" },
        new HashSet<string>(),
        new HashSet<string>())) != TrustedDomainState.Trusted) return false;
    if (statePolicy.EvaluateDomainState("billing.acme.tld", new DomainStateSnapshot(
        new HashSet<string> { "billing.acme.tld" },
        new HashSet<string> { "billing.acme.tld" },
        new HashSet<string>())) != TrustedDomainState.Muted) return false;
    if (statePolicy.EvaluateDomainState("billing.acme.tld", new DomainStateSnapshot(
        new HashSet<string> { "billing.acme.tld" },
        new HashSet<string>(),
        new HashSet<string> { "billing.acme.tld" })) != TrustedDomainState.Revoked) return false;
    if (statePolicy.EvaluateMessageState(message, new MessageStateSnapshot(
        new HashSet<string>(),
        new HashSet<string>(),
        new HashSet<string>(),
        DateTimeOffset.Parse("2026-06-08T08:16:00Z"))) != MessageLifecycleState.Expired) return false;
    if (statePolicy.EvaluateMessageState(message, new MessageStateSnapshot(
        new HashSet<string> { message.Id },
        new HashSet<string> { message.Id },
        new HashSet<string>(),
        DateTimeOffset.Parse("2026-06-08T08:16:00Z"))) != MessageLifecycleState.Deleted) return false;
    return true;
}

static string Base64Url(byte[] value)
{
    return Convert.ToBase64String(value).Replace('+', '-').Replace('/', '_').TrimEnd('=');
}

static bool Throws(Action action)
{
    try
    {
        action();
        return false;
    }
    catch
    {
        return true;
    }
}

internal sealed record TestCase(string File, bool Manifest, bool Valid);
