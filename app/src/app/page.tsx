'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { AnimatedBeam } from '../components/AnimatedBeam';
import { NumberTicker } from '../components/NumberTicker';
import { ThemeToggle } from '../components/ThemeToggle';
import { BASESCAN, DEMO_PROPOSAL, shortHex } from '../lib/config';
import { getConfig, getRun, postGrant, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { fireSever } from '../lib/sever';
import { connect, signGrant, type Connection } from '../lib/wallet';

const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'];
const reached = (s: string | undefined, target: string) =>
  s != null && (ORDER.indexOf(s) >= ORDER.indexOf(target) || s === 'revoked');
const decisionClass = (d?: string) => (d === 'For' ? 'green' : d === 'Against' ? 'red' : 'amber');

const STATUS_LABEL: Record<string, string> = {
  granted: 'Permission granted',
  redelegated: 'Permission narrowed',
  analyzing: 'Deciding in TEE…',
  decided: 'Decided',
  voting: 'Casting…',
  voted: 'Vote cast ✓',
  failed: 'Failed',
  revoked: 'Chain severed',
};

export default function Home() {
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [rootDel, setRootDel] = useState<Delegation | null>(null);
  const [busy, setBusy] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [recallTx, setRecallTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const orchRef = useRef<HTMLDivElement>(null);
  const analystRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getConfig().then(setCfg).catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!runId) return;
    const tick = async () => {
      try {
        const r = await getRun(runId);
        setRun(r);
        if (['voted', 'failed', 'revoked'].includes(r.status) && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    timer.current = setInterval(tick, 2000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId]);

  // The wow-moment: fire the fracture burst the instant the chain is severed.
  useEffect(() => {
    if (recallTx) void fireSever(chainRef.current);
  }, [recallTx]);

  async function onConnect() {
    setError(null);
    try {
      setConn(await connect());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onGrant() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    setRecallTx(null);
    try {
      const c = conn ?? (await connect());
      setConn(c);
      const grant = await signGrant(c.userSA, { governor: cfg.governor, proposalId: cfg.proposalId, orchestratorSA: cfg.orchestratorSA });
      setRootDel(grant.rootDelegation);
      const { runId: id } = await postGrant(grant);
      setRun(null);
      setRunId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRecall() {
    if (!conn || !rootDel) return;
    setRecalling(true);
    setError(null);
    try {
      const { txHash } = await recall(conn.userSA, rootDel);
      setRecallTx(txHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecalling(false);
    }
  }

  const s = run?.status;
  const venice = run?.venice;
  const parts = run?.delegations.participants;
  const youAddr = parts?.user ?? conn?.userSA.address;
  const orchAddr = parts?.orchestrator ?? cfg?.orchestratorSA;
  const analystAddr = parts?.analyst ?? cfg?.analyst;
  const killed = !!recallTx;

  const steps = [
    { done: reached(s, 'granted'), label: 'You signed the locked permission', node: null as React.ReactNode },
    { done: reached(s, 'redelegated'), label: 'Orchestrator narrowed + passed it on', node: null as React.ReactNode },
    {
      done: reached(s, 'decided'), label: 'Analyst decided inside the Venice TEE',
      node: venice ? (
        <div className="body decision mt-sm">
          <span className={`pill ${decisionClass(venice.decision)}`}>{venice.decision}</span>{' '}
          {venice.attestation.verified && <span className="pill green">TEE attested ✓</span>}{' '}
          <span className="mono label">{venice.model}</span>
          <div className="rationale">“{venice.rationale}”</div>
        </div>
      ) : null,
    },
    {
      done: reached(s, 'voted'), fail: s === 'failed', label: 'Vote cast on Base',
      node: run?.vote ? (
        <a className="mono body mt-sm" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">castVote tx {shortHex(run.vote.txHash, 5)} ↗</a>
      ) : null,
    },
  ];
  const terminal = ['voted', 'failed', 'revoked'].includes(s ?? '');
  const currentIdx = run && !terminal ? steps.findIndex((st) => !st.done) : -1;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand"><span className="fox">🦊</span><span><span className="mark">Mandate</span></span></div>
        <div className="topbar-controls">
          <ThemeToggle />
          <span className="chain-badge">Base Sepolia</span>
        </div>
      </div>

      <div className="hero">
        <h1 className="title">Let an AI vote for you —<br /><span className="hl">on a leash you can cut anytime.</span></h1>
        <p className="sub">
          You hand an AI agent ONE locked permission to cast a single DAO vote. It decides privately
          and votes on-chain. Change your mind? Sever the whole chain in one click — live, on-chain.
        </p>
      </div>

      {/* plain-language explainer */}
      <div className="how">
        <div className="how-step"><div className="ic">🎟️</div><div className="h">1 · Hand over a locked permission</div><div className="p">You sign one permission: an AI may cast <b>this one vote</b> — and nothing else. It can’t touch your funds or vote elsewhere.</div></div>
        <div className="how-step"><div className="ic">🔒</div><div className="h">2 · AI decides privately, then votes</div><div className="p">The AI reads the proposal inside a sealed secure enclave (TEE) and casts your vote on-chain — provably untampered.</div></div>
        <div className="how-step"><div className="ic">✂️</div><div className="h">3 · Cut it loose anytime</div><div className="p">One click severs the chain on-chain. The AI <b>instantly</b> loses all power to vote — watch it die.</div></div>
      </div>

      {/* connect */}
      <div className={`card connect-bar ${conn ? 'live' : ''} row spread`}>
        <div>
          <div className="label">Your wallet · root delegator</div>
          <div className="mono">{conn ? conn.address : 'not connected'}</div>
          {conn && <div className="label mt-sm">MetaMask smart account&nbsp;<span className="mono">{shortHex(conn.userSA.address, 6)}</span></div>}
        </div>
        {!conn && <button onClick={onConnect}>Connect MetaMask</button>}
      </div>

      {/* proposal */}
      <div className="card">
        <div className="row spread">
          <div className="card-title">The proposal being voted on {cfg && <span className="mono label">#{shortHex(cfg.proposalId, 5)}</span>}</div>
          {cfg && <a className="mono" href={`${BASESCAN}/address/${cfg.governor}`} target="_blank" rel="noreferrer">Governor {shortHex(cfg.governor, 4)} ↗</a>}
        </div>
        <p className="mt-sm mb-0">{DEMO_PROPOSAL}</p>
        <div className="row gap-sm mt-md">
          <span className="pill brand">🔒 only this vote</span>
          <span className="pill brand">🚫 can’t move funds</span>
          <span className="pill brand">↩︎ revocable</span>
        </div>
      </div>

      {/* the animated authority chain — centerpiece */}
      <div className="card">
        <div className="label mb-0">Live authority chain</div>
        <div className={`chain ${killed ? 'killed' : ''} mt-md`} ref={chainRef}>
          <ChainNode nodeRef={youRef} avatar="🧑" who="You" role="grant the permission" addr={youAddr} active={!!conn} killed={killed} />
          <ChainNode nodeRef={orchRef} avatar="🤖" who="Orchestrator" role="narrows the permission" addr={orchAddr} active={reached(s, 'redelegated')} working={s === 'granted'} killed={killed} />
          <ChainNode nodeRef={analystRef} avatar="🔎" who="Analyst" role="decides + casts the vote" addr={analystAddr} active={reached(s, 'analyzing')} working={s === 'redelegated' || s === 'analyzing'} tee={s === 'analyzing'} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={youRef} toRef={orchRef} live={reached(s, 'redelegated')} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={orchRef} toRef={analystRef} live={reached(s, 'analyzing')} killed={killed} />
        </div>

        {/* agent-authority meter — full while the grant is live, snaps to 0 on sever */}
        {run && (
          <div className={`authority ${killed ? 'killed' : ''} mt-md`}>
            <span className="label">Agent authority</span>
            <div className="ameter"><div className="afill" style={{ width: killed ? '0%' : '100%' }} /></div>
            <span className="aval"><NumberTicker value={killed ? 0 : 100} suffix="%" /></span>
          </div>
        )}

        {/* live result */}
        {venice && !killed && (
          <div className="decision mt-lg row gap-sm">
            <span className="label">AI decided:</span>
            <span className={`pill ${decisionClass(venice.decision)}`}>{venice.decision}</span>
            {venice.attestation.verified && <span className="pill green">verified in TEE ✓</span>}
            <span className="rationale" style={{ flexBasis: '100%' }}>“{venice.rationale}”</span>
          </div>
        )}
        {run?.vote && !killed && (
          <div className="vote-burst mt-md">
            <span className="check">✓</span>
            <span>Vote cast on-chain</span>
            <a className="mono" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{shortHex(run.vote.txHash, 5)} ↗</a>
          </div>
        )}
        {killed && (
          <div className="recall-confirmation">
            🔪 <strong>Chain severed — the AI can no longer vote.</strong> The next attempt reverts on-chain.{' '}
            <a className="mono" href={`${BASESCAN}/tx/${recallTx}`} target="_blank" rel="noreferrer">proof tx {shortHex(recallTx ?? undefined, 5)} ↗</a>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="card row spread">
        <div className="label">{killed ? 'This grant is dead. Re-connect or reload to start over.' : 'Sign once. The agents do the rest. Revoke whenever you want.'}</div>
        {run && run.status === 'voted' && !killed ? (
          <button className="danger big" onClick={onRecall} disabled={recalling || !rootDel || !conn}>{recalling ? 'Severing…' : '✂️ Recall — kill the chain'}</button>
        ) : (
          <button className="big" onClick={onGrant} disabled={busy || !cfg || (!!s && s !== 'failed') || killed}>{busy ? 'Signing…' : 'Grant one-vote authority'}</button>
        )}
      </div>

      {error && <div className="card err">⚠ {error}</div>}

      {/* technical detail / proof */}
      {run && (
        <div className="card">
          <div className="row spread mb-0">
            <div className="label">Under the hood · run <span className="mono">{shortHex(run.runId, 6)}</span></div>
            <StatusPill status={killed ? 'revoked' : run.status} />
          </div>
          <div className="steps">
            {steps.map((st, i) => (
              <Step key={i} done={st.done} current={i === currentIdx} fail={st.fail} label={st.label}>{st.node}</Step>
            ))}
          </div>
          <div className="hashes">
            <div className="hrow"><span className="label">Root delegation hash</span><span className="mono">{shortHex(run.delegations.rootHash, 6)}</span></div>
            <div className="hrow"><span className="label">Redelegation hash</span><span className="mono">{run.delegations.redelegationHash ? shortHex(run.delegations.redelegationHash, 6) : '—'}</span></div>
          </div>
          {run.error && <div className="err mt-md">⚠ {run.error.code}: {run.error.message}</div>}
        </div>
      )}

      <p className="label mt-lg">
        Demo wallet must be the seeded voter. Start the orchestrator (<span className="mono">pnpm --filter @mandate/orchestrator serve</span>) and refresh a proposal (<span className="mono">pnpm proposal --reseed</span>) before granting.
      </p>
    </div>
  );
}

function ChainNode({ nodeRef, avatar, who, role, addr, active, working, tee, killed }: { nodeRef?: React.RefObject<HTMLDivElement | null>; avatar: string; who: string; role: string; addr?: string; active?: boolean; working?: boolean; tee?: boolean; killed?: boolean }) {
  return (
    <div ref={nodeRef} className={`cnode ${killed ? 'killed' : working ? 'working active' : active ? 'active' : ''}`}>
      <span className="avatar">{avatar}</span>
      <div className="who">{who}</div>
      <div className="role">{role}</div>
      {tee && !killed && <div className="tee"><span className="sweep" />🔒 thinking…</div>}
      {addr && <a className="mono label" style={{ display: 'inline-block', marginTop: 6 }} href={`${BASESCAN}/address/${addr}`} target="_blank" rel="noreferrer">{shortHex(addr, 4)}</a>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'voted' ? 'green' : status === 'failed' || status === 'revoked' ? 'red' : 'amber';
  return <span className={`pill ${cls}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function Step({ done, current, fail, label, children }: { done?: boolean; current?: boolean; fail?: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className={`step ${fail ? 'fail' : done ? 'done' : current ? 'current' : ''}`}>
      <div className="rail"><div className="dot" /><div className="line" /></div>
      <div><div>{label}</div>{children}</div>
    </div>
  );
}
