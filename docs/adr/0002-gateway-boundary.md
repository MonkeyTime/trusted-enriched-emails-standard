# ADR 0002: Gateway Boundary

## Status

Accepted

## Context

Clients should receive realtime messages without connecting directly to internal brokers such as RabbitMQ.

## Decision

Clients connect to an authenticated gateway. The gateway translates client subscriptions into broker subscriptions and enforces manifest, user, route, and signature policy.

## Consequences

Broker topology stays private. Client SDKs can support WebSocket/SSE while deployments choose RabbitMQ, Kafka, Redis Streams, NATS, or provider events behind the gateway.
