import type { Edge, Node, XYPosition } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { VOTE_BOARD_ADDRESS, type RunStatus } from '@mandate/shared';
import type { TallyBreakdown } from '../../lib/voteboard-view';

export const ACTOR_NODE_TYPE = 'actor';
export const SCOPE_TOKEN_NODE_TYPE = 'scopeToken';
export const AUTHORITY_EDGE_TYPE = 'authority';

export const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'] as const;

export type ActorRole = 'you' | 'orch' | 'analyst' | 'voteBoard';
export type GraphTone = 'brand' | 'info' | 'ok' | 'warn' | 'bad' | 'mute';
export type ActorState = 'dim' | 'active' | 'working' | 'pending' | 'settled' | 'failed' | 'killed';

export interface ActorCopy {
  name: string;
  role: string;
}

export interface TallyLabels {
  for: string;
  against: string;
  abstain: string;
}

export interface GraphCopy {
  actors: Record<ActorRole, ActorCopy>;
  scopeFull: string;
  scopeAttenuated: string;
  thinking: string;
  tallyLabels: TallyLabels;
}

export interface BuildGraphInput {
  s?: string;
  killed: boolean;
  youAddr?: string;
  orchAddr?: string;
  analystAddr?: string;
  isConnected: boolean;
  tally: TallyBreakdown;
  redelegated: boolean;
  venice?: RunStatus['venice'];
  vote?: RunStatus['vote'];
  copy: GraphCopy;
}

export type ActorNodeData = {
  role: ActorRole;
  name: string;
  roleText: string;
  addr?: string;
  tone: GraphTone;
  state: ActorState;
  killed: boolean;
  tee: boolean;
  verdict?: string;
  thinkingLabel: string;
  tally?: TallyBreakdown;
  tallyLabels?: TallyLabels;
} & Record<string, unknown>;

export type ScopeTokenNodeData = {
  label: string;
  redelegated: boolean;
  killed: boolean;
} & Record<string, unknown>;

export type AuthorityEdgeData = {
  live: boolean;
  settled: boolean;
  failed: boolean;
  killed: boolean;
} & Record<string, unknown>;

export type ActorGraphNode = Node<ActorNodeData, typeof ACTOR_NODE_TYPE>;
export type ScopeTokenGraphNode = Node<ScopeTokenNodeData, typeof SCOPE_TOKEN_NODE_TYPE>;
export type AuthorityGraphNode = ActorGraphNode | ScopeTokenGraphNode;
export type AuthorityGraphEdge = Edge<AuthorityEdgeData, typeof AUTHORITY_EDGE_TYPE>;

export interface AuthorityGraph {
  nodes: AuthorityGraphNode[];
  edges: AuthorityGraphEdge[];
}

const ACTOR_POSITIONS: Record<ActorRole, XYPosition> = {
  you: { x: 0, y: 190 },
  orch: { x: 290, y: 190 },
  analyst: { x: 580, y: 190 },
  voteBoard: { x: 870, y: 190 },
};

const SCOPE_Y = 72;

export function reached(s: string | undefined, target: (typeof ORDER)[number]): boolean {
  if (s == null) return false;
  if (s === 'revoked') return true;
  const current = ORDER.indexOf(s as (typeof ORDER)[number]);
  const needed = ORDER.indexOf(target);
  return current >= 0 && needed >= 0 && current >= needed;
}

export function buildGraph(input: BuildGraphInput): AuthorityGraph {
  const s = input.killed ? 'revoked' : input.s;
  const failed = !input.killed && s === 'failed';
  const atGranted = reached(s, 'granted') || failed;
  const atRedelegated = input.redelegated || reached(s, 'redelegated');
  const atAnalyzing = reached(s, 'analyzing');
  const atDecided = reached(s, 'decided');
  const atVoting = reached(s, 'voting');
  const atVoted = reached(s, 'voted');
  const hasStarted = atGranted || s === 'failed' || s === 'revoked';
  const failingRole = failed ? failureRole(input) : undefined;
  const scopeOnAnalyst = atRedelegated;

  const nodes: AuthorityGraphNode[] = [
    actorNode('you', input.youAddr, input, actorState('you', input, { atGranted, atVoted, failingRole }), roleTone('you', input, failingRole)),
    actorNode('orch', input.orchAddr, input, actorState('orch', input, { atGranted, atRedelegated, atVoted, failingRole }), roleTone('orch', input, failingRole)),
    actorNode(
      'analyst',
      input.analystAddr,
      input,
      actorState('analyst', input, { atRedelegated, atAnalyzing, atDecided, atVoted, failingRole }),
      roleTone('analyst', input, failingRole),
    ),
    actorNode(
      'voteBoard',
      VOTE_BOARD_ADDRESS,
      input,
      actorState('voteBoard', input, { atVoting, atVoted, failingRole }),
      roleTone('voteBoard', input, failingRole),
    ),
    {
      id: 'scope_token',
      type: SCOPE_TOKEN_NODE_TYPE,
      position: { x: scopeOnAnalyst ? ACTOR_POSITIONS.analyst.x : ACTOR_POSITIONS.orch.x, y: SCOPE_Y },
      hidden: !hasStarted,
      selectable: false,
      draggable: false,
      data: {
        label: scopeOnAnalyst ? input.copy.scopeAttenuated : input.copy.scopeFull,
        redelegated: scopeOnAnalyst,
        killed: input.killed,
      },
      zIndex: 2,
    },
  ];

  const edges: AuthorityGraphEdge[] = [
    edge('e_you_orch', 'you', 'orch', {
      live: !input.killed && !failed && s === 'redelegated',
      settled: !input.killed && !failed && (atAnalyzing || atDecided || atVoting || atVoted),
      failed: failingRole === 'orch',
      killed: input.killed,
    }),
    edge('e_orch_analyst', 'orch', 'analyst', {
      live: !input.killed && !failed && s === 'analyzing',
      settled: !input.killed && !failed && (atDecided || atVoting || atVoted),
      failed: failingRole === 'analyst',
      killed: input.killed,
    }),
    edge('e_analyst_board', 'analyst', 'voteBoard', {
      live: !input.killed && !failed && s === 'voting',
      settled: !input.killed && !failed && atVoted,
      failed: failingRole === 'voteBoard',
      killed: input.killed,
    }),
  ];

  return { nodes, edges };
}

function actorNode(
  role: ActorRole,
  addr: string | undefined,
  input: BuildGraphInput,
  state: ActorState,
  tone: GraphTone,
): ActorGraphNode {
  const copy = input.copy.actors[role];
  return {
    id: role,
    type: ACTOR_NODE_TYPE,
    position: ACTOR_POSITIONS[role],
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selectable: false,
    draggable: false,
    data: {
      role,
      name: copy.name,
      roleText: copy.role,
      addr,
      tone,
      state,
      killed: input.killed,
      tee: role === 'analyst' && input.s === 'analyzing',
      verdict: role === 'analyst' && reached(input.s, 'decided') ? input.venice?.decision : undefined,
      thinkingLabel: input.copy.thinking,
      tally: role === 'voteBoard' ? input.tally : undefined,
      tallyLabels: role === 'voteBoard' ? input.copy.tallyLabels : undefined,
    },
    zIndex: 3,
  };
}

function edge(
  id: string,
  source: ActorRole,
  target: ActorRole,
  data: AuthorityEdgeData,
): AuthorityGraphEdge {
  return {
    id,
    type: AUTHORITY_EDGE_TYPE,
    source,
    target,
    sourceHandle: 'out',
    targetHandle: 'in',
    selectable: false,
    focusable: false,
    data,
    zIndex: 1,
  };
}

function actorState(
  role: ActorRole,
  input: BuildGraphInput,
  flags: {
    atGranted?: boolean;
    atRedelegated?: boolean;
    atAnalyzing?: boolean;
    atDecided?: boolean;
    atVoting?: boolean;
    atVoted?: boolean;
    failingRole?: ActorRole;
  },
): ActorState {
  if (input.killed) return 'killed';
  if (flags.failingRole === role) return 'failed';
  if (role === 'you') {
    if (flags.atVoted) return 'settled';
    return input.isConnected || flags.atGranted ? 'active' : 'dim';
  }
  if (role === 'orch') {
    if (flags.atVoted) return 'settled';
    if (input.s === 'granted') return 'working';
    return flags.atRedelegated ? 'active' : 'dim';
  }
  if (role === 'analyst') {
    if (flags.atVoted) return 'settled';
    if (input.s === 'redelegated' || input.s === 'analyzing') return 'working';
    return flags.atDecided ? 'active' : 'dim';
  }
  if (input.s === 'voting') return 'pending';
  if (flags.atVoted) return 'settled';
  return 'dim';
}

function roleTone(role: ActorRole, input: BuildGraphInput, failingRole: ActorRole | undefined): GraphTone {
  if (input.killed || failingRole === role) return 'bad';
  if (role === 'you') return 'brand';
  if (role === 'voteBoard') return input.s === 'voted' ? 'ok' : 'ok';
  if (role === 'analyst' && reached(input.s, 'decided')) return decisionTone(input.venice?.decision);
  return 'info';
}

function decisionTone(decision: string | undefined): GraphTone {
  if (decision === 'For') return 'ok';
  if (decision === 'Against') return 'bad';
  if (decision === 'Abstain') return 'warn';
  return 'info';
}

function failureRole(input: BuildGraphInput): ActorRole {
  if (input.vote) return 'voteBoard';
  if (input.venice) return 'voteBoard';
  if (input.redelegated) return 'analyst';
  return 'orch';
}
