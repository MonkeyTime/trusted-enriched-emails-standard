# State Policy

SDKs define standard lifecycle states, but clients own persistence.

## Trusted Domain States

- `trusted`: the domain is allowed by local user policy.
- `muted`: the domain remains known, but messages should not notify or surface prominently.
- `revoked`: the domain is blocked locally; subscriptions and interactive privileges must fail closed.

Evaluation precedence:

1. `revoked`
2. `muted`
3. `trusted`

Unknown domains evaluate as `revoked`.

## Message Lifecycle States

- `visible`: the message can be shown normally.
- `dismissed`: the user dismissed the message without permanent deletion.
- `deleted`: the user deleted the message and it must not reappear if republished with the same id.
- `superseded`: a newer message replaces this one.
- `expired`: `expiresAt` has passed.

Evaluation precedence:

1. `deleted`
2. `superseded`
3. `expired`
4. `dismissed`
5. `visible`

## Persistence Boundary

SDKs provide `StatePolicy` and snapshot types. Clients must persist the underlying sets, such as trusted domains, muted domains, revoked domains, deleted message ids, dismissed message ids, and superseded message ids.

This keeps user state local to the client while preserving the same behavior across implementations.
