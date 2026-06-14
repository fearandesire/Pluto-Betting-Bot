# Grafana / Loki MCP access

This repo ships a project-scoped MCP server config (`.mcp.json` at the repo
root) that gives Claude Code access to your Grafana Cloud stack — including
Loki log queries (LogQL), label discovery, datasource listing, Prometheus,
dashboards, and alerts.

The server used is the official [`grafana/mcp-grafana`](https://github.com/grafana/mcp-grafana),
launched via `uvx mcp-grafana -t stdio`. `uvx` is already available in the
Claude Code on the web environment; on first launch it downloads and caches
the package (~47 MB), so the first session may take a few extra seconds to
connect.

## Required environment variables

The config references two variables — it intentionally does **not** hard-code
any secrets:

| Variable                         | Example                              | Notes                              |
| -------------------------------- | ------------------------------------ | ---------------------------------- |
| `GRAFANA_URL`                    | `https://<org>.grafana.net`          | Your Grafana Cloud instance URL    |
| `GRAFANA_SERVICE_ACCOUNT_TOKEN`  | `glsa_xxxxxxxxxxxxxxxxxxxx`          | Grafana service account token      |

### Where to set them

These are **secrets** — do not commit them. Set them as environment variables
on the Claude Code environment that runs this repo:

- **Claude Code on the web**: open the environment's settings and add both
  variables under environment variables / secrets. See
  https://code.claude.com/docs/en/claude-code-on-the-web for where the
  environment is configured.
- **Local CLI**: export them in your shell (or your shell profile) before
  launching Claude Code:

  ```bash
  export GRAFANA_URL="https://<org>.grafana.net"
  export GRAFANA_SERVICE_ACCOUNT_TOKEN="glsa_..."
  ```

### Creating the service account token

In Grafana Cloud: **Administration → Users and access → Service accounts →
Add service account**. Give it a role with at least `Viewer` (and `Datasources
Reader`) so it can run Loki/Prometheus queries, then **Add service account
token** and copy the `glsa_...` value into `GRAFANA_SERVICE_ACCOUNT_TOKEN`.

## Verifying

Once the variables are set, start a fresh Claude Code session. The `grafana`
MCP server will appear and you can ask Claude to, e.g., "list my Loki
datasources" or "query Loki for error logs in the last hour".

## Trimming the tool surface (optional)

The official server exposes a broad set of tools. To keep it focused on logs,
you can disable categories you don't need by adding flags to the `args` in
`.mcp.json`, e.g.:

```json
"args": ["mcp-grafana", "-t", "stdio", "-disable-alerting", "-disable-dashboard", "-disable-admin"]
```

Run `uvx mcp-grafana --help` to see all `-disable-*` flags.
