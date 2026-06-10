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

### …and why it must be a *chain* (re-delegation, not N flat grants)

The orchestrator→analyst hop is not decoration — remove `parentDelegation` and the product breaks:

- **One signature, rotating workforce.** You sign once, to the orchestrator. It can spin up, retire
  or replace analyst agents (fresh keys, fresh TEE sessions) by re-delegating — narrower each time —
  without ever sending you back to MetaMask. Flat grants would mean a popup per analyst, forever.
- **Attenuation is enforced, not promised.** A child delegation can only **narrow** its parent. The
  analyst's scope (this board, `castVote` only, fewer votes, shorter window) is validated against
  the parent's authority on-chain at redemption — the orchestrator *cannot* hand out more than it holds.
- **The kill switch only exists because it's a chain.** Every leaf hangs off the root by parent-hash,
  so one `disableDelegation(root)` revokes every downstream agent at once — that's Recall. With N
  flat grants you'd be hunting down N separate revocations while a rogue agent keeps voting.

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

| Track | Status | Evidence |
|---|---|---|
| General qualification — SAK smart account + ERC-7710 **standing grant** in the main flow | ✅ live | grant signing in [`app/src/lib/wallet.ts`](./app/src/lib/wallet.ts); redeem tx [`0xc9f4…4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841) |
| **Revocable governance mandate + kill-the-chain (the core)** — Recall disables the root; the next redemption reverts on-chain | ✅ live | disable UserOp [`0x1475…c74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b) → `canRedeem` flips `true → false`; reproduce `pnpm revoke:2hop` |
| **Best use of Venice AI** — the TEE model decides `support` per proposal; attestation verified | ✅ live | decisions discriminate (risky → Against, sound → For); `x-venice-tee: true`; attestation `verified: true` — [EVIDENCE](./EVIDENCE.md#best-venice-ai-live) |
| **Best Agent** — one grant → autonomous analyze → decide → vote, proposal after proposal | ✅ live | `pnpm orchestrate`; the on-chain tally bucket == the Venice decision, redeem tx [`0xd830…1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356) |
| Best A2A coordination — 2-hop attenuated re-delegation (the mechanism behind the mandate) | ✅ live | 3 participants, 2 signed delegations, leaf→root redemption — [EVIDENCE](./EVIDENCE.md#checkpoint-a--best-a2a-live-base-sepolia) |
| **Best 1Shot Permissionless Relayer** — mainnet `castVote` via 7702 + 7710 (USDC gas) | ✅ live on Base **mainnet** | castVote tx [`0x3b54…6a07`](https://basescan.org/tx/0x3b5448aaac605e1416be48e238c12a755532b762d392dd70f4025e5a152a6a07); burner code `0xef0100…` (7702-upgraded through 1Shot); fee 0.01 USDC, burner holds 0 ETH |
| **Best x402 + ERC-7710** — self-built seller; the agent pays per-query via a scoped delegation | ✅ live | `pnpm x402:demo` → `402 → scoped Erc20TransferAmount delegation → on-chain settle → data` |

Full receipts per track: [`EVIDENCE.md`](./EVIDENCE.md).

## Run it

```bash
pnpm install
pnpm -r build && pnpm -r test          # 184 tests, all green: 101 shared · 50 app · 20 Foundry · 13 agents

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

## Honest limitations

Documented choices, not hidden stubs:

- **Demo-scoped governance.** The app's standing mandate runs on our self-built `VoteBoard`; the
  OpenZeppelin `Governor` path is the CLI reproduction (`pnpm vote:2hop`) — same SAK primitives,
  scope tightened to one locked `proposalId`. `votingPeriod` is **300 s** so a judge can reproduce a
  full grant → vote → recall cycle in minutes, not days.
- **mUSDC is a mock.** The x402 toll settles in our 6-decimal `MockUSDC` on Base Sepolia. The only
  real-USDC money leg is the 1Shot mainnet relay fee (0.01 USDC).
- **Self-built x402 seller.** The seller verifies and redeems the scoped ERC-7710 delegation itself;
  it does not settle through Coinbase's x402 facilitator.
- **Venice inference is prepaid.** x402 pays the proposal-data toll; the Venice TEE call itself is
  billed to a prepaid API key.
- **The app's mainnet panel is an honest replay.** It replays pinned, real Base-mainnet artifacts
  (the castVote tx and USDC fee, linked to Basescan) with a genuinely **live** `eth_getCode` 7702
  check; live mainnet execution stays opt-in via CLI (`pnpm 1shot:vote`).
- The mainnet Governor and every proposal carry `HACKATHON DEMO — NO REAL VALUE` and a 0 treasury.

## Safety / boundaries

Throwaway keys only; secrets stay in `.env` (gitignored). Testnet first. Any mainnet action (the
1Shot leg, ~$5 USDC) is opt-in and quoted live before signing. The mainnet Governor + every proposal
carry a `HACKATHON DEMO — NO REAL VALUE` disclaimer.

## License

MIT.
