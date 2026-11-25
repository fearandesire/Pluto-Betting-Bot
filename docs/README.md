# Pluto documentation

This docs tree captures Pluto client architecture notes, operational guides, and cross-service release details that are too specific for the root README.

## Reference

- [Configuration reference](configuration.md): runtime environment variables and feature flags, with defaults and dependencies

## Architecture decisions

- [ADR 001: Durable notification receiver](architecture/decisions/001-durable-notification-receiver.md)
- [ADR 002: Atomic cache operations](architecture/decisions/002-atomic-cache-operations.md)

## Feature guides

- [Durable notification receiver](features/durable-notification-receiver.md)
- [Bet result notifications](features/bet-result-notifications.md): result and refund DMs, and how refund reasons are worded
- [Player props](features/props.md): `/props` server settings, daily posting, and the `/admin props` tools
- [Game channels and postponed games](features/game-lifecycle.md)
- [Recaps and leaderboard posts](features/recaps-and-leaderboards.md)
- [Betting ops alerts](features/betting-ops-alerts.md)
- [Internal moderation route](internal-moderation-route.md)
- [Components V2 guide](components-v2/README.md)

## CI/CD

- [Khronos client update workflow](ci-cd-khronos-client-update.md)

## Cross-service context

The Khronos release cascade and the cross-service contract are documented in the private Khronos repository.
