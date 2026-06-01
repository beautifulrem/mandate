# Mandate — revocable AI governance delegation

> Grant an AI agent a **scoped, revocable** right to vote your DAO governance on your behalf —
> then kill the entire delegation chain on-chain in one click.
>
> Hackathon entry: **MetaMask Smart Accounts Kit × 1Shot API × Venice AI "Dev Cook-Off"** (submit by 2026-06-15).

## The flow

1. **Grant a standing mandate** — your MetaMask smart account signs **one** ERC-7710 delegation: an
   AI may `castVote` on **any** proposal on this DAO board, **vote-only** (never your funds), bounded
   by a **vote cap + validity window** you choose, revocable anytime. (Caveats: `AllowedTargets` +
   `AllowedMethods`, plus `LimitedCalls` / `Timestamp`.)
2. **Re-delegate (the mechanism)** — an **Orchestrator** smart account attenuated-redelegates that
   right to an **Analyst**. This 2-hop ERC-7710 chain is what makes the mandate *attenuable* and
   *cascade-revocable*; it is the plumbing, not the pitch.
3. **Decide** — the Analyst privately analyses **each** proposal inside a **Venice TEE** (Intel TDX)
   and decides For / Against / Abstain — the cast `support` provably comes from the model, not hardcoded.
4. **Vote** — the Analyst redeems the chain leaf→root; the DelegationManager executes `castVote`
   **as your smart account**. Under the one grant the agent votes proposal after proposal, up to your cap.
5. **Recall (the wow)** — you hit **Recall** → one `disableDelegation` on the root cascade-revokes the
   whole chain; the next redemption reverts on-chain. *Self-custody you can watch.*

> The repo also ships a CLI path (`pnpm vote:2hop`) that runs the **same** mechanism against a real
> OpenZeppelin `Governor`, with the scope tightened further to a single **locked `proposalId`** — an
> even narrower variant of the same delegation, kept for the on-chain Governor receipts in `EVIDENCE.md`.

## Why ERC-7710 — nothing weaker gives all four at once

Letting an AI vote *your* governance demands **four properties at the same time**, and only a
scoped, revocable ERC-7710 delegation delivers all four. Every weaker option fails at least one:

| Approach | Vote-only (can't touch funds) | Bounded (≤N votes, expires) | Revocable on-chain in one click | Custody kept (key never exposed) |
|---|:--:|:--:|:--:|:--:|
| Hand the agent a private key / seed | ❌ can do anything | ❌ | ❌ must rotate the key | ❌ |
| Broad session key / full-account delegation | ❌ can move funds | ⚠️ | ⚠️ | ✅ |
| `delegate()` voting power (ERC20Votes) | ⚠️ delegates *weight to an address*, not a *bounded agent mandate* | ❌ | ❌ re-delegate ≠ revoke-an-agent | ✅ |
| Co-sign every vote | ✅ | n/a | n/a | ✅ but ❌ not autonomous |
| Custodial "AI voting" service | ✅ | ✅ | ⚠️ trust the operator | ❌ |
| **Mandate — ERC-7710 scoped + revocable** | ✅ `AllowedMethods`=castVote · `AllowedTargets`=this board | ✅ `LimitedCalls` + `Timestamp` caveats | ✅ `disableDelegation` cascade-revokes the chain | ✅ the EVM enforces — the agent can't override |

A voting agent is the *ideal* 7710 use case: you want it to act **repeatedly and autonomously** (a
standing mandate), yet provably **only vote — never spend**, and you want to **pull the plug the
instant it misbehaves**. That exact shape — recurring · scoped-to-one-method · zero-funds · instant
on-chain revoke — is what ERC-7710 caveats plus `disableDelegation` give, and a bare key, a session
key, or token-weight `delegate()` do not. Note the contrast: DAOs already let you delegate voting
*power* to an address you trust to vote however *it* likes; Mandate instead delegates a **scoped,
bounded, revocable mandate to an agent that decides per-proposal in a TEE** — and you can yank it
without ever moving your tokens. The **Tamper Probe** proves the negative live: ask the delegated
agent to move funds and the redemption **reverts at the enforcer**, on-chain.

## Live on Base Sepolia (84532)

| | address | used by |
|---|---|---|
| **VoteBoard** (multi-proposal board) | [`0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B`](https://sepolia.basescan.org/address/0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B) | the **app demo** — the standing vote-only mandate casts here |
| VotesToken (ERC20Votes) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) | the CLI / Governor path |
| MandateGovernor (OZ) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) | the CLI `vote:2hop` (locked-`proposalId`) path |

Per-track on-chain receipts are in **[`EVIDENCE.md`](./EVIDENCE.md)**.

## Tracks

**The pitch in one line:** a *standing, vote-only, revocable* AI governance mandate — an agent votes
any proposal on the DAO for you, **provably cannot touch your funds**, and you can **kill the whole
delegation chain on-chain in one click**. The A2A re-delegation, Venice TEE, x402 and 1Shot below are
the mechanism that makes that real (the novelty is the governance use case + the kill switch, not
hop-count).

| Track | Status |
|---|---|
| General qualification — SAK smart account + ERC-7710 **standing grant** in the main flow | ✅ live |
| **Revocable governance mandate + kill-the-chain (the core)** — Recall disables the root; the next redemption reverts on-chain | ✅ live |
| **Best use of Venice AI** — the TEE model decides `support` per proposal; attestation verified | ✅ live |
| **Best Agent** — one grant → autonomous analyze → decide → vote, proposal after proposal | ✅ live |
| Best A2A coordination — 2-hop attenuated re-delegation (the mechanism behind the mandate) | ✅ live |
| **Best 1Shot Permissionless Relayer** — mainnet `castVote` via 7702 + 7710 (USDC gas) | ✅ live on Base mainnet (fee 0.01 USDC, burner 7702-upgraded) |
| **Best x402 + ERC-7710** — self-built seller; the agent pays per-query via a scoped delegation | ✅ live (402 → 7710 settle → data) |

## Run it

```bash
pnpm install
pnpm -r build && pnpm -r test          # 84 tests (shared / contracts(Foundry) / orchestrator)

# one-time: generate throwaway demo keys into .env + print a funding checklist
pnpm bootstrap:accounts                 # then fund the printed addresses from a Base Sepolia faucet

# reproduce the core mechanics live (Base Sepolia, testnet gas only):
pnpm vote:2hop                          # real 2-hop attenuated delegation → castVote on the Governor
pnpm revoke:2hop                        # kill-the-chain: disable root → the same fresh chain reverts
pnpm orchestrate                        # autonomous: grant → Venice TEE decision → real vote
pnpm proposal --reseed --wait           # refresh the (300s) active proposal window

# the full UI demo:
pnpm --filter @mandate/orchestrator serve     # HTTP run API on :8787
pnpm --filter @mandate/app dev                # Next.js app on :3000 (connect MetaMask → Grant → Recall)
```

> The demo wallet must be the seeded voter: import the `.env` `USER_DEMO_PK` into MetaMask so the
> connected smart account is the one seeded with voting power.

## Architecture

See **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. In short — a pnpm monorepo:

```
packages/shared/      delegation (ERC-7710) · Governor/proposal helpers · Venice client · 1Shot client · run contract (zod)
packages/contracts/   Foundry: VotesToken (ERC20Votes, timestamp clock) + MandateGovernor + deploy/propose scripts
agent/orchestrator/   HTTP service: holds the root, attenuated-redelegates, drives the run state machine
agent/analyst/        decides support in the Venice TEE and casts by redeeming the chain
app/                  Next.js 15 — connect, grant (browser signing), live authority graph, Recall
```

## Stack

`@metamask/smart-accounts-kit@1.6.0` (ERC-7710 delegation/redelegation, EIP-7702, Hybrid smart accounts) ·
`viem` · OpenZeppelin Contracts `5.6.1` + Foundry · Venice AI (TEE `e2ee-*` models, `/tee/attestation`) ·
1Shot permissionless relayer (mainnet JSON-RPC) · Pimlico public bundler (UserOps) · Next.js 15 / React 19 ·
Base (Sepolia 84532 · mainnet 8453).

## Smart Accounts Kit surface — what Mandate actually calls

Every delegation primitive is the real SDK, verified against `@metamask/smart-accounts-kit@1.6.0`
(see [`packages/shared/src/delegation.ts`](./packages/shared/src/delegation.ts),
[`app/src/lib/wallet.ts`](./app/src/lib/wallet.ts), [`app/src/lib/recall.ts`](./app/src/lib/recall.ts)):

| API | Where | Role in the mandate |
|---|---|---|
| `toMetaMaskSmartAccount(Implementation.Hybrid)` | `wallet.ts`, agents | the user / orchestrator / analyst ERC-4337 smart accounts (EIP-7702 Hybrid) |
| `getSmartAccountsEnvironment(chainId)` | `delegation.ts` | resolves `DelegationManager` + enforcer addresses per chain |
| `createDelegation({ scope, to, from, environment, salt })` | `delegation.ts` | the **root** grant |
| `createDelegation({ …, parentDelegation })` | `delegation.ts` | the **attenuated re-delegation** (orchestrator → analyst), parent-linked |
| `ScopeType.FunctionCall` (`targets`, `selectors`) | `delegation.ts` | binds the grant to `castVote` on this board only → `AllowedTargets` + `AllowedMethods` enforcers (this is what blocks "move funds") |
| `createCaveatBuilder(env).addCaveat('timestamp' \| 'limitedCalls')` | `delegation.ts` | the standing bounds → `Timestamp` (expiry) + `LimitedCalls` (≤ maxVotes) enforcers |
| `account.signDelegation({ delegation })` | `wallet.ts`, orchestrator | EIP-712 signature over each delegation (root + re-delegation) |
| `createExecution({ target, callData })` + `ExecutionMode.SingleDefault` | `delegation.ts` | the `castVote` action the chain authorizes |
| `contracts.DelegationManager.encode.redeemDelegations(...)` | `delegation.ts` | the analyst redeems the chain **leaf→root** → executes `castVote` *as the user's smart account* |
| `contracts.DelegationManager.encode.disableDelegation(...)` | `delegation.ts` | **the kill switch** — disabling the root cascade-revokes the whole chain |
| `createBundlerClient().sendUserOperation(...)` (viem AA, Pimlico) | `recall.ts` | the recall is a keyless UserOp from the user smart account |

Enforcers exercised: `AllowedTargetsEnforcer` · `AllowedMethodsEnforcer` · `TimestampEnforcer` ·
`LimitedCallsEnforcer` (plus `AllowedCalldataEnforcer` in the single-proposal CLI path, which locks
`proposalId`). The decoded scope is rendered live in the app's **Permission X-Ray**.

## Safety / boundaries

Throwaway keys only; secrets stay in `.env` (gitignored). Testnet first. Any mainnet action (the
1Shot leg, ~$5 USDC) is opt-in and quoted live before signing. The mainnet Governor + every proposal
carry a `HACKATHON DEMO — NO REAL VALUE` disclaimer.

## License

MIT.
