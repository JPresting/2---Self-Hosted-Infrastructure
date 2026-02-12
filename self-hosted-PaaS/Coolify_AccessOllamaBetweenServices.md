# Accessing Ollama Across Coolify Services
## Setup
Ollama runs in one Coolify stack and is shared with all other stacks on the server via host port binding.
### Ollama Provider Stack
The stack running Ollama must define **port** `11434` on the host (not expose):
```yaml
services:
  ollama-api:
    image: ollama/ollama:latest
    ports:
      - '11434:11434'
    environment:
      - OLLAMA_HOST=0.0.0.0
      - 'OLLAMA_ORIGINS=*'
```
- `OLLAMA_HOST=0.0.0.0` – Required so Ollama accepts connections from outside the container
- `OLLAMA_ORIGINS=*` – Required to allow cross-origin requests from other services
- `ports: '11434:11434'` – Makes Ollama reachable on the host at port 11434
---
## Connecting From Any Other Service
Any Coolify service on the same server can connect to Ollama by adding this to its compose:
```yaml
services:
  my-service:
    image: whatever
    environment:
      - 'OLLAMA_BASE_URL=http://host.docker.internal:11434'
    extra_hosts:
      - host.docker.internal:host-gateway
```
- `host.docker.internal` resolves to the host machine
- `extra_hosts` line is required on Linux to enable this resolution
- Works regardless of which Coolify stack the consuming service is in
---
## Verify Connection
From any container's terminal in Coolify, test the connection:
```bash
curl http://host.docker.internal:11434/api/tags
```
This should return a JSON list of all installed Ollama models.
---
## Important Notes
- Ollama is **not reachable from the internet** – only from containers on the same server
- All services share the **same models** – no need to install models multiple times
- If Ollama's stack restarts, all connected services will briefly lose access until it's back up