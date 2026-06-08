# Trust Onboarding Profile

This profile defines how a user starts trusting an enriched email domain from a website, traditional email, or manual client entry.

The recommended draft URI scheme is:

```txt
tree://
```

`tree` stands for trusted enriched email. The scheme is not listed in the IANA URI Schemes registry as of the 2026-06-02 registry update, but it should still be treated as a draft name until the project decides whether to register it or choose a longer scheme such as `trustedemail://`.

## Manual Add

Every compatible client should support manual domain entry:

```txt
billing.acme.tld
```

The client must then fetch:

```txt
https://billing.acme.tld/.well-known/realtime-mail.json
```

The client displays the domain name, manifest display name, channels, capabilities, and trust consequences before the user confirms.

## URI Onboarding

Websites and traditional emails may offer an onboarding link:

```txt
tree://trust?domain=billing.acme.tld
```

To suggest a specific channel:

```txt
tree://subscribe?domain=billing.acme.tld&channel=invoice-events
```

The URI only opens the client trust screen. It must never grant trust by itself.

The reference client POC uses this ACME URI as its default onboarding example. When the local reference gateway is running, `billing.acme.tld` is resolved through the gateway's `/.well-known/realtime-mail.json` endpoint to simulate a real trusted-domain manifest fetch.

## HTTPS Fallback

When no native client is registered for `tree://`, websites may link to a hosted fallback page:

```txt
https://realtimemail.org/trust?domain=billing.acme.tld
```

The fallback page should explain the standard and provide installation or client-opening instructions. The final trust decision still belongs to the local mail client.

## Required Client Checks

Before adding trust, the client must:

- validate the domain syntax;
- fetch the `.well-known` manifest over HTTPS;
- validate the manifest schema;
- show channels and capabilities to the user;
- require an explicit user confirmation;
- persist the trusted domain state locally;
- let the user revoke trust and unsubscribe later.

## Security Notes

- Treat onboarding URIs as untrusted input.
- Ignore unknown query parameters.
- Do not allow onboarding links to pre-approve dangerous capabilities.
- Do not subscribe to channels that are not declared by the manifest.
- Do not trust a manifest fetched from a different domain than the requested domain.
