# N8N Task Runners - Known Issue & Workaround

## Problem
N8N versions 1.120+ have a bug in **queue mode with external task runners**:
- Internal JS Task Runner spawns despite `N8N_RUNNERS_MODE=external`
- Internal runner crashes immediately and blocks external runners
- JavaScript Code Nodes timeout after 60 seconds
- Python Code Nodes work fine (bug only affects JavaScript)

**GitHub Issue:** [#22798](https://github.com/n8n-io/n8n/issues/22798)

## Workaround: Use Internal Mode

Instead of running task runners in a separate container, use **internal mode** where task runners run inside the n8n containers.

### Configuration

**Main n8n container:**
```yaml