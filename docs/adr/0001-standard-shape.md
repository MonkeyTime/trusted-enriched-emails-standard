# ADR 0001: Repository Shape

## Status

Accepted

## Context

Realtime Mail needs to be both a standard and an implementation ecosystem.

## Decision

Use one repository with:

- `spec`: normative schemas.
- `docs`: specification, security model, references, and ADRs.
- `conformance`: shared fixtures.
- `packages`: SDKs by language.
- `apps`: reference clients.
- `reference`: reference server-side implementations.

## Consequences

This keeps the draft standard and implementations synchronized while the protocol is still evolving.
