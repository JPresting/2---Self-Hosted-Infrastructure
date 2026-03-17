# Coolify + Docker Compose — Path Bug

## Compose File Location is SET ONCE

In Coolify, the **Docker Compose Location** field can only be set **when creating the resource**. Once created, changing the filename does NOT persist (Coolify Bug [#7654](https://github.com/coollabsio/coolify/issues/7654), [#2521](https://github.com/coollabsio/coolify/issues/2521)).

**Workaround:** Delete the resource and recreate it with the correct path from the start.

## File Extension: `.yml` vs `.yaml`

Coolify defaults to `/docker-compose.yaml`. Our files use `.yml`. When creating the resource, make sure to change the extension to `.yml` — or rename the files to `.yaml`.

## Example

| File | Use case |
|---|---|
| `docker-compose.yml` | Standard with `ports` (direct access) |
| `docker-compose-cloudflare.yml` | Cloudflare/Coolify with `expose` (Traefik routing) |

You can't adapt the same deployment switching in between .yml paths! Even a typo like .yaml instead of .yml is enough for it to not work. You would need to delete the app/resource right away if the path doesn't match!