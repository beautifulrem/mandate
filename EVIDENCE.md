# Mandate — Per-Track Evidence Map

On-chain receipts proving each hackathon track. All testnet artifacts are on **Base Sepolia
(chainId 84532)**; Basescan: `https://sepolia.basescan.org`.

> **Two flows, same primitives.** The interactive **app** casts a *standing, vote-only, revocable*
> mandate on the **VoteBoard** (any proposal, bounded by votes + time). The on-chain **receipts below**
> are from the CLI/Governor reproduction (`pnpm vote:2hop` etc.), which runs the same MetaMask Smart
> Accounts primitives against a real OpenZeppelin `Governor` with the scope tightened to a single
> locked `proposalId`. The 2-hop A2A re-delegation is the *mechanism* behind the mandate, not the pitch.

## Deployed (Base Sepolia)

| What | Address |
|---|---|
| VotesToken (ERC20Votes, timestamp clock) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) |
| MandateGovernor (delay=60s, period=300s) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| User smart account (root delegator / voter) | [`0xEb35F7b58EB654383092569Adc527220A7E89383`](https://sepolia.basescan.org/address/0xEb35F7b58EB654383092569Adc527220A7E89383) |
| Orchestrator smart account | [`0x2caa4D4583015F418F2d962e2E38F7D5E724d16e`](https://sepolia.basescan.org/address/0x2caa4D4583015F418F2d962e2E38F7D5E724d16e) |
| Analyst EOA (leaf delegate) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://sepolia.basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| DelegationManager (MetaMask SAK) | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |

## Tracks

| # | Track | Status | Proof |
|---|---|---|---|
| 1 | **General qualification** — SAK smart account + ERC-7710 in the main flow | ✅ | the redeem tx below casts a real vote via `@metamask/smart-accounts-kit` |
| 2 | Best A2A coordination — 2-hop attenuated re-delegation (the mechanism behind the mandate), redeemed on-chain | ✅ | vote + revoke txs below; 3 participants, 2 signed delegations, leaf→root redemption |
| 3 | **Best 1Shot relayer** — mainnet castVote via 7702 upgrade + 7710 (USDC gas) | ✅ live (mainnet) | real Base-mainnet castVote relayed via 1Shot; burner 7702-upgraded; fee 0.01 USDC (see below) |
| 4 | **Best Venice AI** — TEE model decides `support`; attestation verified | ✅ | live decisions discriminate (risky→Against, sound→For); `x-venice-tee:true`; attestation `verified:true` (see below) |
| 5 | **x402 + ERC-7710** — a self-built seller charges per query; buyer pays via a scoped delegation | ✅ live | 402 → signed Erc20TransferAmount delegation → on-chain settle → data (`pnpm x402:demo`) |
| 6 | **Best Agent** — autonomous analyze→decide→vote after one grant | ✅ | `pnpm orchestrate`: one grant → Venice TEE decision → real castVote; on-chain tally bucket == the decision (see below) |
| 7 | **Kill-the-chain** (wow) — recall disables root; next redeem reverts | ✅ | disable UserOp + cause-proven revert below |
| 8 | **Compliance** — open-source repo, addresses, video | ⏳ T20 | repo + this file |

## Checkpoint A — Best A2A (live, Base Sepolia)

- **2-hop attenuated vote → real `castVote`** (analyst redeems the chain; DelegationManager
  executes as the user SA): [`0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841)
  → `hasVoted(userSA)=true`, `proposalVotes.For = 1000e18`. Reproduce: `pnpm vote:2hop`.
- **Cause-proven cascade-revoke** (user SA disables the root via a UserOp; the same fresh,
  unvoted chain then reverts in simulation): disable UserOp
  [`0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b)
  → `canRedeem` flips `true → false`. Reproduce: `pnpm revoke:2hop`.

> Each demo run reseeds a fresh proposal (votingPeriod=300s), so proposal ids and exact
> tx hashes differ per run; the txs above are representative proof from a live run.

## Best Venice AI (live)

- **TEE model decides `support`** (not hardcoded): on `e2ee-qwen3-5-122b-a10b` (Phala/NEAR-AI
  TEE, Intel TDX) — a risky anonymous-no-audit proposal → **Against (support 0)**, an audited
  milestone+clawback grant → **For (support 1)**. Each completion returns `x-venice-tee: true`.
- **Attestation** `GET /tee/attestation?model=…` → `verified: true`, `server_verification.tdx`
  all-valid, enclave `signing_address 0x6525e128afcffebf7eed05d485d7be983cdae934`, fresh nonce,
  Intel TDX quote + NVIDIA Hopper evidence. Reproduce via `analyzeProposal` / `fetchAttestation`.

## Best 1Shot — real Base **mainnet** relay (live)

Same Governor + token deployed on **Base mainnet (8453)** (name carries `HACKATHON DEMO — NO REAL
VALUE / 0 TREASURY`); basescan: `https://basescan.org`.

| What | value |
|---|---|
| MandateGovernor (mainnet) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| User smart account (root delegator, 7702-upgraded THIS run) | [`0x578215EB18099f48978dFF14a5d03a74242a0dA3`](https://basescan.org/address/0x578215EB18099f48978dFF14a5d03a74242a0dA3) |
| Orchestrator (attenuated re-delegator) | [`0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B`](https://basescan.org/address/0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B) |
| Analyst (leaf delegate · x402 seller) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| Burner (7702 relay sponsor) | [`0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991`](https://basescan.org/address/0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991) |

- **FULL chain in ONE mainnet run (2026-06-12)** — every track end-to-end, reproduce with
  `pnpm 1shot:full --mainnet --estimate` (free quote) then `pnpm 1shot:full --mainnet`:
  - **A2A** a real 3-hop attenuated chain: user SA → orchestrator (root: this board · ≤3 votes ·
    7-day expiry) → analyst (mid: +`limitedCalls 1`) → leaf locked to **exactly**
    `castVote(proposalId, decidedSupport)`. root `0x206a9adc…` · mid `0x669df36a…` · leaf `0x42233d2f…`.
  - **TEE** the Venice committee (4 lenses + arbiter) decided **For** BEFORE the leaf was signed
    (attestation `verified:true`, enclave nonce `83fbc5a9…`).
  - **x402** the agent's USDC budget paid the analyst's **0.001 USDC** data toll on-chain — toll tx
    [`0xb244c3e4…6174`](https://basescan.org/tx/0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174).
  - **1Shot** the relayer redeemed the 3-hop chain — **`castVote` executed AS the user SA**, the
    user's **EIP-7702 upgrade riding the SAME relay call**, the burner sponsoring the USDC fee.
    castVote tx [`0xc48632ca…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)
    (block 47228284). On-chain: `getVote(proposalId, userSA) = 2` (voted · support 1=For), user code
    = `0xef0100‖impl`, fee **0.01 USDC** paid by the sponsor. This is the recorded run the app replays.
- **Earlier minimal 1Shot proof (2026-06-09)** — burner-only castVote
  [`0x3b5448aa…6a07`](https://basescan.org/tx/0x3b5448aaac605e1416be48e238c12a755532b762d392dd70f4025e5a152a6a07);
  superseded by the full-chain run above. Single-leg reproduce: `pnpm 1shot:vote`.

## x402 + ERC-7710 — pay-per-query (live, Base Sepolia)

- A **self-built data seller** (HTTP) returns **402 Payment Required** with an `erc7710` scheme. The
  buyer (a smart account holding MVOTE credits) signs a **scoped `Erc20TransferAmount` delegation**
  and retries with an `X-PAYMENT` header; the seller **redeems it on-chain to settle** (1 MVOTE
  moves buyer→seller), then returns the data. Distinct from the Venice analyst (prepaid API key).
  `pnpm x402:demo` → `402 → scoped delegation → on-chain settle → data`.

## Best Agent — autonomous loop (live)

- **`pnpm orchestrate`**: one signed grant → orchestrator attenuated-redelegates → analyst decides
  in the Venice TEE → analyst redeems the chain → real `castVote`. The cast `support` is whatever
  Venice decided, with **NO hardcoding** — proven on-chain by which tally bucket receives the votes
  (e.g. Venice "For" → `proposalVotes.For = 1000e18`, redeem tx
  [`0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356)).
