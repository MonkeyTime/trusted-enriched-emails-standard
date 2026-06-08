# SDK Compatibility Matrix

This matrix tracks the minimum feature set expected from every official SDK.

| Capability | TypeScript | Python | Go | Rust | Java | C# |
| --- | --- | --- | --- | --- | --- | --- |
| Manifest model | Yes | Yes | Yes | Yes | Yes | Yes |
| Manifest validation | Yes | Yes | Yes | Yes | Yes | Yes |
| Message model | Yes | Yes | Yes | Yes | Yes | Yes |
| Message validation | Yes | Yes | Yes | Yes | Yes | Yes |
| Action model | Yes | Yes | Yes | Yes | Yes | Yes |
| Action validation | Yes | Yes | Yes | Yes | Yes | Yes |
| Unknown property rejection | Yes | Yes | Yes | Yes | Planned | Yes |
| Signed `expiresAt` field | Yes | Yes | Yes | Yes | Yes | Yes |
| Host action broker | Yes | Yes | Yes | Yes | Yes | Yes |
| Gateway SDK profile | Yes | Yes | Yes | Yes | Yes | Yes |
| Trusted domain states | Yes | Yes | Yes | Yes | Yes | Yes |
| Message lifecycle states | Yes | Yes | Yes | Yes | Yes | Yes |
| State policy evaluation | Yes | Yes | Yes | Yes | Yes | Yes |
| Trust policy | Yes | Yes | Yes | Yes | Yes | Yes |
| Signature verification | Ed25519 | Ed25519 | Ed25519 | Ed25519 | Ed25519 | P-256, Ed25519 stub |
| Traditional mail account model | Yes | Yes | Yes | Planned | Yes | Yes |
| Gateway client abstraction | SSE | Planned | Planned | Planned | Interface | Interface |
| Shared conformance fixtures | Yes | Yes | Yes | Yes | Yes | Yes |

## Compatibility Rules

- A feature marked `Yes` must be covered by shared fixtures or language-native tests.
- New schema fields must be added to TypeScript first, then ported to the other SDKs in the same change.
- Host-mediated actions must stay deny-by-default in every SDK.
- Signature verification must validate the canonical message body, not a language-specific serialization.
- A breaking behavior change requires a new fixture in `conformance`.

## Release Gates

Before publishing an SDK release:

1. Run `npm run test` from the repository root.
2. Verify that the SDK reference page in `docs/reference` lists every public class, method, and enum.
3. Update this matrix when a feature moves from `Planned` to `Yes`.
4. Add or update fixtures for every behavior that must stay portable across languages.
