# @mandate/mcp — governance-mandate MCP server

Exposes Mandate's core capability — **request a scoped, revocable governance voting mandate** — to
any MCP client (Claude Desktop, Cursor, another agent). The trust model is the whole point:

> An agent can **describe**, **list proposals for**, and **build a request for** a voting mandate —
> but it can **never self-grant**. `build_mandate_request` returns an **UNSIGNED** ERC-7710
> delegation; only the human owner's MetaMask smart account can sign it, and the owner can
> `disableDelegation` to revoke it on-chain at any time.

## Tools

| Tool | Args | Returns |
|---|---|---|
| `describe_governance_mandate` | — | the mandate's on-chain guarantees (vote-only · bounded · revocable · custody-preserving) |
| `list_dao_proposals` | — | the DAO proposals an agent could be mandated on (id, title, body) |
| `build_mandate_request` | `delegatorSmartAccount` (req), `orchestrator?`, `maxVotes?`, `ttlDays?`, `board?` | the **unsigned** standing vote delegation + decoded scope + enforcers + a human-sign handoff |

The delegation is built with the *same* `@mandate/shared` `buildStandingVoteDelegation` helper the
app and CLI use, so what the agent receives is byte-identical to a real grant.

## Run / register

```bash
pnpm --filter @mandate/mcp build      # tsc → dist/index.js
# optional default delegate for build_mandate_request:
export MANDATE_ORCHESTRATOR_SA=0x…    # the agent smart account that holds the root
```

Register it with an MCP client (stdio). Example `claude_desktop_config.json` / `.mcp.json`:

```json
{
  "mcpServers": {
    "mandate-governance": {
      "command": "node",
      "args": ["/absolute/path/to/agent/mandate-mcp/dist/index.js"],
      "env": { "MANDATE_ORCHESTRATOR_SA": "0x…" }
    }
  }
}
```

(Or run from source without a build: `command: "pnpm"`, `args: ["--filter", "@mandate/mcp", "start"]`.)

## Flow

1. An agent calls `describe_governance_mandate` → understands the scope it may request.
2. `list_dao_proposals` → sees what it could vote on.
3. `build_mandate_request({ delegatorSmartAccount, maxVotes, ttlDays })` → gets the exact unsigned
   delegation + plain-English scope.
4. The agent hands it to the **human owner**, who signs it (MetaMask smart account) — in the Mandate
   app or via `userSA.signDelegation`. Only now is the agent empowered to cast votes, bounded by the
   caveats, and revocable any time.
