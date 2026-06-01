# Mandate — Architecture

A user grants an AI agent hierarchy a **narrow, revocable** right to cast one governance vote, the
agents decide autonomously and privately, and the user can sever the whole chain on-chain at any
moment. Everything below the UI is verified live on Base Sepolia.

## Components (pnpm monorepo)

| Package | Role |
|---|---|
| `packages/shared` | The reusable core: ERC-7710 delegation building/redemption/revoke, Governor + proposal helpers, the Venice TEE client, the 1Shot relayer client, and the zod **run contract** shared by the app and services. Browser-safe (Web Crypto, no `node:*` at runtime). |
| `packages/contracts` | Foundry. `VotesToken` (ERC20Votes on a **timestamp clock**, owner-mint that **auto self-delegates** the recipient) + `MandateGovernor` (Settings/CountingSimple/Votes/QuorumFraction). `script/Deploy.s.sol` + `Propose.s.sol`. |
| `agent/orchestrator` | Holds the root delegation, **attenuated-redelegates** to the analyst, drives the run state machine, and serves the run contract over HTTP (`POST /grant`, `GET /run/:id`, `GET /config`). |
| `agent/analyst` | Decides `support` in the Venice TEE, then casts by redeeming the delegation chain. The cast support is never hardcoded. |
| `app` | Next.js 15 / React 19. Connect MetaMask → derive the user smart account → sign the root delegation in-browser → POST to the orchestrator → live authority graph + Recall. |

## The delegation (the heart)

The grant is an ERC-7710 `createDelegation` with a **FunctionCall scope**. The interactive app uses
the **standing** variant; the CLI keeps an even-tighter single-proposal variant of the same scope.

**Standing mandate (the app demo)** — vote-only on the board, bounded, revocable:

- `targets = [VoteBoard]`, `selectors = ['castVote(uint256,uint8)']` → `AllowedTargets` +
  `AllowedMethods`: the agent can ONLY `castVote` on this board — never move funds, never call anything else.
- plus standing-authority caveats: `Timestamp` (expiry) and/or `LimitedCalls` (≤ maxVotes).
- `proposalId` is **NOT** locked, so the one grant covers *any* current/future proposal — which is
  exactly why being able to **revoke** it matters.

**Single-proposal variant (CLI `vote:2hop`, on the real OZ `Governor`)** — same scope, tightened: adds
`allowedCalldata` locking the **proposalId** (bytes 4..35) and leaving `support` (byte 36) free, so the
agent votes only on *that* proposal while Venice still decides the direction.

```
User SA ──root: castVote scope (vote-only, bounded) · proposalId free [CLI: locked]──▶ Orchestrator SA
Orchestrator SA ──attenuated redelegation (parentDelegation = root)──▶ Analyst EOA
Analyst submits redeemDelegations([redelegation, root], [castVote(proposalId, support)])
   → DelegationManager validates the chain and executes castVote AS the User SA
```

Redemption is **leaf→root**; the execution runs as the **root delegator** (the user SA), so the user
SA must hold voting power at the proposal snapshot. The token's owner-mint auto self-delegates, so
seeding voting power needs no extra UserOp.

### Kill the chain (cause-proven)

Recall is `DelegationManager.disableDelegation(root)` sent by the user SA (a UserOp via a keyless
public bundler). To prove the revert is **caused by the disabled root** and not "already voted", the
revoke flow uses a **fresh, unvoted** proposal: the same signed chain returns `canRedeem = true`
before the disable and `false` after. (`pnpm revoke:2hop`.)

## The autonomous run (state machine)

`POST /grant` (signed root) → the orchestrator creates a run and drives it:

```
granted → redelegated → analyzing → decided → voting → voted        (or → failed)
```

Every transition is validated against the shared `RunStatus` zod contract before it is stored or
served, so the app can only ever render a contract-valid status. The status carries the **two
delegation hashes**, the **three participant addresses**, the **Venice trace** (decision, support,
rationale, attestation), and the **vote receipt** (tx hash, support).

## Venice TEE analyst

- **Model**: resolved at runtime from `GET /models` by the `supportsTeeAttestation` capability (the
  `e2ee-*` models; default `e2ee-qwen3-5-122b-a10b`). The old `tee-*` naming is gone — discovered
  and corrected at build time.
- **Decision**: a governance system prompt → strict JSON `{decision, rationale}` → mapped to the OZ
  support code (For=1, Against=0, Abstain=2). Robust to reasoning models (parses the final answer).
- **Proof**: each completion returns `x-venice-tee: true` (Phala / NEAR-AI, Intel TDX). The
  `GET /tee/attestation` report gives `verified: true`, the enclave `signing_address`, a nonce, and
  the TDX quote — surfaced as a "TEE attested" badge.
- **Payment**: a Venice API key + USD credit (prepaid). x402 wallet payment is an optional
  alternative, not required — so no on-chain USDC is needed for inference.

## 1Shot mainnet relay (the moat)

The 1Shot public relayer is permissionless (no key) but **mainnet-only** (Base Sepolia
`relayer_getCapabilities` returns `{}`). The client (`getCapabilities` / `getFeeData` /
`estimate7710` / `send7710` / `getStatus` + Ed25519 webhook verification + the `0xef0100` 7702
post-upgrade check) is verified read-only against the live mainnet relayer (minFee ≈ $0.01). The
actual mainnet `castVote` via a 7702-upgraded burner is the opt-in mainnet leg (ask-first, ~$5 USDC).

## Key decisions & reality-checks

- **Timestamp clock** on the token+governor so `votingDelay=60s` / `votingPeriod=300s` make a tight
  demo window; a `pnpm proposal --reseed` helper keeps a fresh `Active` proposal.
- **Auto self-delegating mint** — a deployer-only seed activates a smart-account voter without it
  sending its own delegate UserOp.
- **OZ + forge-std as git submodules** under `packages/contracts/lib/` — avoids pnpm's out-of-root
  symlinks that solc's allow-paths rejects.
- **Browser-safe shared package** — the webhook verifier uses Web Crypto (type-only `node:crypto`
  import) so the barrel bundles client-side for the Next.js app.
- **Keyless Pimlico public bundler** (`public.pimlico.io/v2/84532/rpc`) relays the user SA's recall
  UserOp; the SA self-pays gas (no paymaster).

## Reproduce

`pnpm vote:2hop` · `pnpm revoke:2hop` · `pnpm orchestrate` · `pnpm proposal --reseed` — each prints
its on-chain receipts. The UI ties them together (`orchestrator serve` + `app dev`).
