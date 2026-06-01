import { describe, expect, it } from 'vitest';
import { VOTE_BOARD_ADDRESS } from '@mandate/shared';
import { tallyBreakdown } from '../../lib/voteboard-view';
import {
  ACTOR_NODE_TYPE,
  AUTHORITY_EDGE_TYPE,
  SCOPE_TOKEN_NODE_TYPE,
  buildGraph,
  reached,
  type ActorGraphNode,
  type AuthorityGraph,
  type AuthorityGraphEdge,
  type BuildGraphInput,
  type GraphCopy,
  type ScopeTokenGraphNode,
} from './graphModel';

const COPY: GraphCopy = {
  actors: {
    you: { name: 'You', role: 'grant' },
    orch: { name: 'Orchestrator', role: 'narrow' },
    analyst: { name: 'Analyst', role: 'decide' },
    voteBoard: { name: 'VoteBoard', role: 'tally' },
  },
  scopeFull: '4 caveats',
  scopeAttenuated: 'attenuated',
  thinking: 'Thinking…',
  tallyLabels: { for: 'For', against: 'Against', abstain: 'Abstain' },
};

const TALLY = tallyBreakdown(1, 3, 1); // 1 against, 3 for, 1 abstain

function build(overrides: Partial<BuildGraphInput> = {}): AuthorityGraph {
  return buildGraph({
    s: undefined,
    killed: false,
    youAddr: '0xyou',
    orchAddr: '0xorch',
    analystAddr: '0xanalyst',
    isConnected: false,
    tally: TALLY,
    redelegated: false,
    venice: undefined,
    vote: undefined,
    copy: COPY,
    ...overrides,
  });
}

const actor = (g: AuthorityGraph, role: string) => g.nodes.find((n) => n.id === role) as ActorGraphNode;
const scope = (g: AuthorityGraph) => g.nodes.find((n) => n.id === 'scope_token') as ScopeTokenGraphNode;
const edge = (g: AuthorityGraph, id: string) => g.edges.find((e) => e.id === id) as AuthorityGraphEdge;

describe('reached', () => {
  it('is false for an unstarted run', () => {
    expect(reached(undefined, 'granted')).toBe(false);
  });

  it('is true once the run has progressed past the target', () => {
    expect(reached('granted', 'granted')).toBe(true);
    expect(reached('voting', 'analyzing')).toBe(true);
    expect(reached('voted', 'voted')).toBe(true);
  });

  it('is false when the run has not yet reached the target', () => {
    expect(reached('granted', 'voting')).toBe(false);
  });

  it('treats revoked as having reached everything (the chain existed, then was cut)', () => {
    expect(reached('revoked', 'voted')).toBe(true);
  });
});

describe('buildGraph — topology (stable across every state)', () => {
  const g = build();

  it('emits four actor nodes + one scope token', () => {
    const actors = g.nodes.filter((n) => n.type === ACTOR_NODE_TYPE);
    const scopes = g.nodes.filter((n) => n.type === SCOPE_TOKEN_NODE_TYPE);
    expect(actors.map((n) => n.id).sort()).toEqual(['analyst', 'orch', 'voteBoard', 'you']);
    expect(scopes).toHaveLength(1);
  });

  it('wires the three authority hops you→orch→analyst→board', () => {
    expect(g.edges.map((e) => e.id)).toEqual(['e_you_orch', 'e_orch_analyst', 'e_analyst_board']);
    expect(g.edges.every((e) => e.type === AUTHORITY_EDGE_TYPE)).toBe(true);
  });

  it('binds the board node to the real on-chain VoteBoard address + live tally', () => {
    const board = actor(g, 'voteBoard');
    expect(board.data.addr).toBe(VOTE_BOARD_ADDRESS);
    expect(board.data.tally).toEqual(TALLY);
    expect(board.data.tallyLabels).toEqual(COPY.tallyLabels);
  });

  it('only the board carries tally data', () => {
    expect(actor(g, 'you').data.tally).toBeUndefined();
    expect(actor(g, 'orch').data.tally).toBeUndefined();
    expect(actor(g, 'analyst').data.tally).toBeUndefined();
  });
});

describe('buildGraph — idle / disconnected', () => {
  const g = build();

  it('dims You and hides the scope token until a grant starts', () => {
    expect(actor(g, 'you').data.state).toBe('dim');
    expect(scope(g).hidden).toBe(true);
  });

  it('leaves every hop unlit', () => {
    for (const e of g.edges) {
      expect(e.data?.live).toBe(false);
      expect(e.data?.settled).toBe(false);
      expect(e.data?.killed).toBe(false);
    }
  });
});

describe('buildGraph — connected, pre-grant', () => {
  const g = build({ isConnected: true });

  it('lights You and leaves the agents dim', () => {
    expect(actor(g, 'you').data.state).toBe('active');
    expect(actor(g, 'orch').data.state).toBe('dim');
    expect(actor(g, 'analyst').data.state).toBe('dim');
    expect(actor(g, 'voteBoard').data.state).toBe('dim');
  });

  it('still hides the scope token (nothing granted yet)', () => {
    expect(scope(g).hidden).toBe(true);
  });
});

describe('buildGraph — granted', () => {
  const g = build({ isConnected: true, s: 'granted' });

  it('sets the orchestrator working and reveals the full scope token at the orchestrator', () => {
    expect(actor(g, 'orch').data.state).toBe('working');
    const sc = scope(g);
    expect(sc.hidden).toBe(false);
    expect(sc.data.label).toBe(COPY.scopeFull);
    expect(sc.data.redelegated).toBe(false);
  });

  it('does not yet flow the first hop (authority granted, not yet redelegated)', () => {
    expect(edge(g, 'e_you_orch').data?.live).toBe(false);
    expect(edge(g, 'e_you_orch').data?.settled).toBe(false);
  });
});

describe('buildGraph — redelegated (scope attenuates + slides to the analyst)', () => {
  const g = build({ isConnected: true, s: 'redelegated', redelegated: true });

  it('flows the you→orch hop', () => {
    expect(edge(g, 'e_you_orch').data?.live).toBe(true);
  });

  it('shrinks + relabels the scope token and moves it onto the analyst', () => {
    const sc = scope(g);
    expect(sc.data.redelegated).toBe(true);
    expect(sc.data.label).toBe(COPY.scopeAttenuated);
    // slid from the orchestrator column (x=290) to the analyst column (x=580)
    expect(sc.position.x).toBe(580);
  });
});

describe('buildGraph — analyzing (the TEE shimmer)', () => {
  const g = build({ isConnected: true, s: 'analyzing', redelegated: true });

  it('flows the orch→analyst hop and settles the first hop behind it', () => {
    expect(edge(g, 'e_orch_analyst').data?.live).toBe(true);
    expect(edge(g, 'e_you_orch').data?.settled).toBe(true);
  });

  it('marks the analyst as thinking-in-TEE', () => {
    expect(actor(g, 'analyst').data.tee).toBe(true);
    expect(actor(g, 'analyst').data.state).toBe('working');
  });
});

describe('buildGraph — decided (verdict tints the analyst)', () => {
  it('surfaces a For verdict as an ok tone', () => {
    const g = build({ isConnected: true, s: 'decided', redelegated: true, venice: { decision: 'For' } as never });
    expect(actor(g, 'analyst').data.verdict).toBe('For');
    expect(actor(g, 'analyst').data.tone).toBe('ok');
  });

  it('surfaces an Against verdict as a bad tone', () => {
    const g = build({ isConnected: true, s: 'decided', redelegated: true, venice: { decision: 'Against' } as never });
    expect(actor(g, 'analyst').data.tone).toBe('bad');
  });

  it('surfaces an Abstain verdict as a warn tone', () => {
    const g = build({ isConnected: true, s: 'decided', redelegated: true, venice: { decision: 'Abstain' } as never });
    expect(actor(g, 'analyst').data.tone).toBe('warn');
  });
});

describe('buildGraph — voting → voted', () => {
  it('pulses the board pending while the cast is in flight', () => {
    const g = build({ isConnected: true, s: 'voting', redelegated: true });
    expect(actor(g, 'voteBoard').data.state).toBe('pending');
    expect(edge(g, 'e_analyst_board').data?.live).toBe(true);
  });

  it('settles the whole chain once the vote lands', () => {
    const g = build({ isConnected: true, s: 'voted', redelegated: true, vote: { support: 1 } as never });
    expect(actor(g, 'you').data.state).toBe('settled');
    expect(actor(g, 'orch').data.state).toBe('settled');
    expect(actor(g, 'analyst').data.state).toBe('settled');
    expect(actor(g, 'voteBoard').data.state).toBe('settled');
    expect(g.edges.every((e) => e.data?.settled)).toBe(true);
  });
});

describe('buildGraph — killed (the kill-the-chain moment)', () => {
  const g = build({ isConnected: true, s: 'voted', redelegated: true, killed: true });

  it('marks every actor killed with a bad tone', () => {
    for (const role of ['you', 'orch', 'analyst', 'voteBoard']) {
      expect(actor(g, role).data.state).toBe('killed');
      expect(actor(g, role).data.tone).toBe('bad');
      expect(actor(g, role).data.killed).toBe(true);
    }
  });

  it('severs every hop and kills the scope token', () => {
    for (const e of g.edges) {
      expect(e.data?.killed).toBe(true);
      expect(e.data?.live).toBe(false);
    }
    expect(scope(g).data.killed).toBe(true);
  });
});

describe('buildGraph — failed (the break localises to the responsible hop)', () => {
  it('blames the orchestrator when nothing was redelegated yet', () => {
    const g = build({ isConnected: true, s: 'failed' });
    expect(actor(g, 'orch').data.state).toBe('failed');
    expect(edge(g, 'e_you_orch').data?.failed).toBe(true);
  });

  it('blames the analyst when redelegation happened but no decision came back', () => {
    const g = build({ isConnected: true, s: 'failed', redelegated: true });
    expect(actor(g, 'analyst').data.state).toBe('failed');
    expect(edge(g, 'e_orch_analyst').data?.failed).toBe(true);
  });

  it('blames the board when the cast itself reverted', () => {
    const g = build({ isConnected: true, s: 'failed', redelegated: true, venice: { decision: 'For' } as never });
    expect(actor(g, 'voteBoard').data.state).toBe('failed');
    expect(edge(g, 'e_analyst_board').data?.failed).toBe(true);
  });
});
