# Coolify: Deploying Docker Compose from Public Git Repositories

## The Problem

When deploying a Docker Compose stack from a public Git repository in Coolify, **bind mounts with relative paths will silently fail** unless you enable a specific setting.

## Why It Happens

1. Coolify clones your repository to build and start the containers
2. The containers start successfully and bind mounts are created
3. **Coolify deletes the cloned repository after deployment**
4. The bind mount now points to a path that no longer exists on the server
5. Docker automatically creates **empty directories** for every missing path — including files

This means a file like `./config/settings.yml` mounted into a container becomes an **empty directory** named `settings.yml` instead of the actual file from your repo. Your application either crashes or falls back to default configuration without any obvious error.

### Example

```yaml
# docker-compose.yaml
services:
  myapp:
    image: some/image:latest
    volumes:
      - ./config:/etc/myapp   # ← this path won't exist after deployment
```

Typical error when a file becomes a directory:

```
IsADirectoryError: [Errno 21] Is a directory: '/etc/myapp/config.toml'
```

Or the application silently uses default config because your mounted files are missing.

## The Fix

In your Coolify resource settings under **General**, enable:

> ☑ **Preserve Repository During Deployment**
>
> *"Git repository (based on the base directory settings) will be copied to the deployment directory."*

This keeps the cloned repository on the server so that all relative bind mount paths resolve correctly.

## Other Coolify Docker Compose Gotchas

### Domain Port Mapping

When assigning a domain to a service in Coolify, you **must include the internal container port**:

```
✅  https://myapp.example.com:8080
❌  https://myapp.example.com          ← returns 404
```

Traefik needs to know which port to route to. Without it, you get a 404.

### `expose` vs `ports`

- Use `expose` for services that are accessed through Coolify's Traefik proxy (most services)
- Use `expose` for internal-only services that other containers talk to
- `ports` is generally not needed in Coolify — Traefik handles external routing

### Multiple Stacks from One Repository

If your repository contains multiple Docker Compose stacks in subdirectories, create **separate Coolify resources** for each and set the **Docker Compose Location** accordingly:

```
my-repo/
├── docker-compose.yaml              # Stack A
├── stack-b/
│   └── docker-compose.yaml          # Stack B (set Base Directory to /stack-b)
└── stack-c/
    └── docker-compose.yaml          # Stack C (set Base Directory to /stack-c)
```