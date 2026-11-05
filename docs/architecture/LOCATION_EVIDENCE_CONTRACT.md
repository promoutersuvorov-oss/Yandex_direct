# Location and infrastructure evidence contract

## Separate proof for place and distance

A verified place and a verified distance are different claims. The `infrastructure[].source` supports the identity/existence and category of the place. It does **not** automatically support a distance or walking-time metric.

When `distanceMeters` or `walkingMinutes` is supplied, the passport must also include `distanceEvidence`:
- `method`: `walking_route` or `straight_line`;
- `checkedAt`: when the route/distance was checked;
- `validUntil`: expiry of that check;
- `source`: a traceable HTTPS source for the route/distance evidence.

A walking-time value requires a distance and `method: walking_route`. A straight-line measurement must never be described as a walking route or paired with walking minutes.

## Publication behavior

- A verified place with a valid traceable place source can appear without any distance label.
- Distance/time metrics are emitted only when their separate evidence is traceable, checked no later than the current build, and not expired.
- If the place is verified but its metric evidence is missing, malformed or expired, the place card remains while the metric is omitted and a build warning is recorded.
- The renderer labels metrics explicitly as `по маршруту` or `по прямой`.
- No map, route calculation, travel time, availability, or proximity promise is implied.
- Provisional, missing or conflicting places are excluded from the public review profile.

## Why this is strict

A developer page may confirm that a school or park exists nearby without proving a specific route, distance or walking time. The generator must not transform a qualitative proximity statement into a numeric claim. This contract keeps the useful local-infrastructure story while preventing unsupported precision.
