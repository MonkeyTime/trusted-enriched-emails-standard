# ADR 0003: Capability Model

## Status

Accepted

## Context

Interactive email content is dangerous if treated like normal web content.

## Decision

Realtime Mail uses explicit deny-by-default capabilities. Messages receive only the capabilities declared by the channel, supported by the client, and approved by local trust policy.

## Consequences

HTML/CSS can be broadly supported. Script execution, network access, storage, notifications, and URL opening require separate policy checks.
