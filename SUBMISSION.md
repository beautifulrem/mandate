# SUBMISSION.md — HackQuest submission copy (DRAFT)

> Paste-ready copy for the HackQuest form fields. Nothing here is published yet.
> The GitHub issues and the X thread at the bottom are **drafts pending go-ahead**.

---

## One-liner (project tagline)

> Grant an AI a **vote-only, revocable** governance mandate. A Venice TEE decides every vote,
> x402 pays the data toll, 1Shot relays on Base **mainnet** — and one click revokes the entire
> delegation chain on-chain.

## 描述 / Description

### The problem

DAOs already let you delegate voting *power* — but only to an address you must trust to vote
however *it* likes, forever, until you move your tokens. And every "AI agent" product that could
do the voting for you wants either your private key (one prompt injection from disaster) or a
co-signature on every action (not autonomous at all).

### The answer

**Mandate** is a standing, vote-only, revocable AI governance mandate. Your MetaMask smart
account signs **one** ERC-7710 delegation: an AI may `castVote` on this DAO board — nothing
else — bounded by a vote cap and a validity window you choose. The agent then votes proposal
after proposal, autonomously, and you can **kill the whole delegation chain on-chain in one
click** the instant you stop trusting it.

### How it works

1. **Grant** — one MetaMask signature creates the root delegation (`AllowedTargets` +
   `AllowedMethods` = castVote-only, plus `LimitedCalls` + `Timestamp` bounds).
2. **Re-delegate** — an Orchestrator smart account attenuated-redelegates to an Analyst
   (`parentDelegation`, narrower scope). This 2-hop chain is what makes the mandate attenuable
   and cascade-revocable.
3. **Decide** — the Analyst analyses each proposal privately inside a **Venice TEE** (Intel TDX,
   `e2ee-*` model, attestation `verified: true`). The cast `support` provably comes from the
   model — the on-chain tally bucket matches the TEE decision. **Four Venice endpoints run in the
   main flow** (`/models` · `/chat/completions` · `/tee/attestation` · `/audio/speech`): the
   arbiter even *speaks* its verdict via Venice TTS.
4. **Pay** — the agent pays a per-query x402 toll for proposal data by signing a scoped
   `Erc20TransferAmount` delegation; the seller redeems it on-chain to settle.
5. **Vote** — the Analyst redeems the chain leaf→root; the DelegationManager executes
   `castVote` **as your smart account**. On Base **mainnet**, the cast is relayed by the 1Shot
   permissionless relayer: a burner EOA is 7702-upgraded *through 1Shot*, holds 0 ETH, and pays
   the 0.01 USDC fee in USDC. The relay ships a **signed-webhook status feed**
   (`destinationUrl` → `POST /webhooks/1shot`, Ed25519-verified against the relayer JWKS;
   register with `pnpm 1shot:vote --webhook <url>`) — the webhook-over-polling pattern the
   1Shot track calls out.
6. **Recall (the wow)** — one `disableDelegation(root)` cascade-revokes everything downstream.
   The next redemption reverts on-chain. Self-custody you can watch.

### Why this REQUIRES ERC-7710 re-delegation

A voting agent needs four properties **at once**: vote-only (can't touch funds), bounded
(≤N votes, expires), revocable on-chain in one click, and custody kept. A bare key, a session
key, token-weight `delegate()`, and custodial services each fail at least one (full comparison
table in the README). And it must be a *chain*, not N flat grants:

- **One signature, rotating workforce** — the orchestrator can replace analysts by re-delegating
  without ever sending the user back to MetaMask.
- **Attenuation is enforced, not promised** — a child can only narrow its parent; checked
  on-chain at redemption.
- **The kill switch only exists because it's a chain** — one `disableDelegation(root)` revokes
  every downstream agent at once.

The **Tamper Probe** in the app proves the negative live: two real `eth_call`s against the
DelegationManager — the honest castVote passes, the tampered fund-transfer reverts at
`AllowedMethodsEnforcer`.

### Tracks claimed (honestly)

| Track | Evidence |
|---|---|
| General qualification (SAK + ERC-7710 in the main flow) | grant flow `app/src/lib/wallet.ts`; redeem tx [`0xc9f4…4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841) |
| Best A2A coordination | 3 participants, 2 signed delegations, leaf→root redemption — `EVIDENCE.md` |
| Best use of Venice AI | 4 endpoints in the main flow (models/chat/attestation/**speech** — the arbiter speaks); TEE decisions discriminate; attestation `verified: true` |
| Best x402 + ERC-7710 | `pnpm x402:demo` → `402 → scoped Erc20TransferAmount delegation → on-chain settle → data` |
| Best 1Shot Permissionless Relayer | **Base mainnet** castVote tx [`0x3b54…6a07`](https://basescan.org/tx/0x3b5448aaac605e1416be48e238c12a755532b762d392dd70f4025e5a152a6a07); burner 7702-upgraded through 1Shot; fee 0.01 USDC, 0 ETH |
| Best Smart Accounts Agent | `pnpm orchestrate`: one grant → TEE decision → real castVote; tally bucket == decision |
| Kill-the-chain (the core wow) | disable UserOp [`0x1475…c74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b) → `canRedeem` flips `true → false` |

### Honest limitations

Documented choices, not hidden stubs (full list in the README):

- The app's standing mandate runs on our self-built `VoteBoard`; the OZ `Governor` path is the
  CLI reproduction with the scope tightened to one locked `proposalId`. `votingPeriod` = 300 s
  so judges can reproduce grant → vote → recall in minutes.
- The x402 toll settles in a self-deployed `MockUSDC` on Base Sepolia; the only real-USDC leg
  is the 1Shot mainnet fee (0.01 USDC). The seller is self-built (no Coinbase facilitator).
- Venice inference itself is prepaid (API key); x402 pays the proposal-data toll.
- The app's mainnet panel **replays** pinned, real Base-mainnet artifacts (linked txs + a live
  `eth_getCode` 7702 check); live mainnet execution stays opt-in via CLI.

### Judge quick links

- Repo: https://github.com/beautifulrem/mandate (MIT)
- Per-track on-chain receipts: `EVIDENCE.md`
- Demo video: *(T20 — link pending)*
- Live app: https://mandate-app-murex.vercel.app (no public orchestrator → lands on the mainnet replay; the live Sepolia flow runs locally per the README)
- Reproduce everything: `pnpm vote:2hop` · `pnpm revoke:2hop` · `pnpm orchestrate` ·
  `pnpm x402:demo` · `pnpm 1shot:vote --estimate`

## 本次黑客松进展 / Progress during the hackathon

**Phase 0 — validate before building.** Before writing features we ran go/no-go spikes against
the real stacks: (1) `createDelegation(ScopeType.FunctionCall)` + `parentDelegation`
re-delegation + leaf→root `redeemDelegations` + `disableDelegation` on Base Sepolia;
(2) 1Shot relayer capability probing; (3) Venice TEE model resolution. The spikes surfaced the
constraints that shaped the design — 1Shot's permissionless relayer is **mainnet-only**
(`relayer_getCapabilities` on Base Sepolia returns `{}`), Venice TEE models are named `e2ee-*`
(not `tee-*`), and fresh Venice keys ship with a $0 spend limit that blocks every call. We
designed around all three honestly instead of pretending: testnet for the mechanism, one real
opt-in mainnet leg for the 1Shot track.

**The delegation core.** Root grant (castVote-only scope + `LimitedCalls`/`Timestamp` bounds),
attenuated re-delegation, leaf→root redemption, cause-proven cascade-revoke — all against the
real `DelegationManager`, reproducible via CLI (`pnpm vote:2hop` / `revoke:2hop`).

**The autonomous loop.** `pnpm orchestrate`: one signed grant → orchestrator re-delegates →
analyst decides inside the Venice TEE → redeems the chain → real `castVote`. No hardcoded
`support` — the on-chain tally bucket is whatever the model decided.

**The x402 leg.** A self-built seller answers `402 Payment Required` with an `erc7710` scheme;
the buyer signs a scoped `Erc20TransferAmount` delegation; the seller redeems it on-chain and
returns the data.

**The 1Shot mainnet leg.** Deployed the Governor to Base mainnet (`HACKATHON DEMO — NO REAL
VALUE`), 7702-upgraded a burner *through 1Shot* on first use (authorizationList), and relayed a
real `castVote` with gas paid in USDC (fee 0.01 USDC; the burner holds 0 ETH).

**The app.** Next.js 15 mission-control UI: connect → grant (browser signing) → live authority
graph (SSE-streamed run state, polling fallback) → Venice TEE panel (spoken verdict via Venice
TTS) → x402 toll card → 1Shot mainnet replay → **Recall** → Tamper Probe (live success + revert
pair, enforcer named on screen). An **MCP server** (`agent/mandate-mcp`) lets any agent REQUEST a
mandate — the request returns UNSIGNED; only the human's MetaMask smart account can grant.

**Engineering quality.** 198 tests, all green (108 shared · 55 app · 20 Foundry · 15 agents);
TypeScript strict; eslint; browser-safe shared package (Web Crypto, no runtime `node:*`);
throwaway keys + gitignored secrets; every mainnet action opt-in and quoted live before signing.

## 融资状态 / Funding status

Not fundraising. Mandate is an open-source (MIT) hackathon build focused on proving one
primitive: a scoped, revocable, chain-killable AI governance mandate. Open to ecosystem grants
and follow-on collaboration with the MetaMask / Base / Venice / 1Shot ecosystems.

---

# Appendix A — Feedback-track GitHub issues (✅ FILED 2026-06-11)

Real friction from the build, filed as actionable issues from the team account (@beautifulrem)
— paste these links into the form's feedback field:

| # | Issue | Link |
|---|---|---|
| A1 | Venice api-docs — "TEE models" are actually `e2ee-*`; document the prefix + capability-based discovery | https://github.com/veniceai/api-docs/issues/283 |
| A2 | Venice api-docs — fresh API keys silently fail until the per-key USD spend limit is raised; name the cause in the error | https://github.com/veniceai/api-docs/issues/284 |
| A3 | 1Shot docs — `relayer_getCapabilities` returns `{}` on unsupported chains; return an explicit unsupported signal (complements 1Shot-API-Examples#1) | https://github.com/1Shot-API/1shot-documentation/issues/2 |
| A4 | MetaMask SAK — docs gap: when ERC-7715 suffices vs when you need 7710 `createDelegation` (function-call scopes) | https://github.com/MetaMask/smart-accounts-kit/issues/263 |

# Appendix B — X (Twitter) thread (DRAFT — not posted yet)

> Post from the team account; tag @MetaMaskDev; attach the demo video / Tamper-Probe clip.

1/ Your DAO vote, on autopilot — without giving an AI your keys.
Mandate: sign ONE MetaMask delegation and an AI votes for you, provably **vote-only**, bounded,
and revocable on-chain in one click. Built for the @MetaMaskDev Dev Cook-Off 🧵

2/ The grant is an ERC-7710 delegation with teeth: AllowedTargets+AllowedMethods pin it to
`castVote` on one board, LimitedCalls caps the votes, Timestamp expires it. The EVM enforces
the scope — not our backend.

3/ The brain runs inside a Venice TEE (Intel TDX, attestation verified). Each proposal is
analysed privately; the cast `support` is whatever the model decided — you can read it off the
on-chain tally bucket.

4/ The agent pays its own way: a 402 → it signs a scoped Erc20TransferAmount delegation →
the seller settles it on-chain → data unlocked. x402 × ERC-7710, no blanket approvals.

5/ On Base mainnet the vote is relayed by 1Shot's permissionless relayer: a burner EOA,
7702-upgraded *through 1Shot*, holds 0 ETH and pays a $0.01 fee in USDC. Real tx, real receipt.

6/ The kill switch: one `disableDelegation(root)` and the ENTIRE delegation chain dies —
the next redemption reverts at the enforcer. We even ship a Tamper Probe: ask the agent to
move funds and watch the chain refuse. Self-custody you can watch. Repo + receipts: [link]

---

# Appendix C — remaining submission checklist

- [ ] Record the <3-min demo video (every track capability ON SCREEN, per judge requirement)
- [ ] (optional) Record the separate pitch/路演 video — HackQuest has a second video slot
- [ ] Deploy the app and fill the "Live app" link above
- [x] File the Appendix-A issues from the team account, then list them in the form (Feedback track) — filed 2026-06-11, links above
- [ ] Post the Appendix-B thread, link it in the form (Social-media track)
- [ ] Fill HackQuest fields from this file (one-liner / 描述 / 进展 / 融资状态)
- [ ] Final pass: every tx link resolves, every command in README reproduces
