# Internal moderation route

Pluto exposes an API-key-authenticated route for trusted internal services to
resolve a Discord user's moderator permissions in configured guilds:

```http
GET /internal/moderation/guilds?user_id=<discord-snowflake>
X-API-Key: <service-api-key>
```

A successful response contains the requested `user_id`, the configured guilds
where the user is the owner or has `KICK_MEMBERS` or `BAN_MEMBERS`, and an ISO
`checked_at` timestamp. Guild owners receive both reported permissions. Unknown
users and users without either permission receive an empty `guilds` array.

Missing or invalid user IDs return `400`. Missing or invalid service
credentials return `401`. If any configured guild cannot be checked, including
when the five-second lookup deadline is reached, Pluto returns `503` with
`{"error":"moderation_lookup_unavailable"}` and no partial result.
