#!/usr/bin/env node
/**
 * Mandate governance MCP server (stdio). Exposes the "request a scoped, revocable voting mandate"
 * capability to any MCP client (Claude Desktop, Cursor, another agent, …). An agent can describe
 * the mandate, list the DAO's proposals, and BUILD an unsigned grant request — but it can never
 * self-grant: the returned delegation must be signed by the human owner's MetaMask smart account.
 */
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Address } from 'viem';
import { buildMandateRequest, describeMandate, listProposals } from './mandate.js';

const ORCH_ENV = process.env.MANDATE_ORCHESTRATOR_SA as Address | undefined;

const TOOLS = [
  {
    name: 'describe_governance_mandate',
    description:
      'Explain what a Mandate governance grant is and its on-chain guarantees (vote-only, bounded, revocable, custody-preserving). No arguments.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_dao_proposals',
    description: 'List the DAO proposals an agent could be mandated to vote on (id, title, body). No arguments.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'build_mandate_request',
    description:
      'Build the exact UNSIGNED ERC-7710 standing vote delegation an agent is asking the owner to grant. Returns the unsigned delegation, the decoded scope (vote-only on this board, optional ≤N-votes and expiry, revocable) and the enforcers. A mandate is always bounded: if you give neither maxVotes nor ttlDays, a 30-day expiry is applied. The human owner must sign it — agents cannot self-grant.',
    inputSchema: {
      type: 'object',
      properties: {
        delegatorSmartAccount: { type: 'string', description: "the human owner's MetaMask smart account (the root delegator who signs)" },
        orchestrator: { type: 'string', description: 'the agent smart account that will hold the root (defaults to env MANDATE_ORCHESTRATOR_SA)' },
        maxVotes: { type: 'number', description: 'cap the mandate to ≤N votes (omit for no cap)' },
        ttlDays: { type: 'number', description: 'expire the mandate after N days (omit for no expiry)' },
        board: { type: 'string', description: 'the VoteBoard / Governor address (defaults to the deployed board)' },
      },
      required: ['delegatorSmartAccount'],
    },
  },
];

function text(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] };
}

async function main() {
  const server = new Server({ name: 'mandate-governance', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name } = req.params;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    try {
      if (name === 'describe_governance_mandate') return text(describeMandate());
      if (name === 'list_dao_proposals') return text(listProposals());
      if (name === 'build_mandate_request') {
        const delegator = args.delegatorSmartAccount as Address | undefined;
        if (!delegator) throw new Error('delegatorSmartAccount is required (the owner smart account).');
        const orchestrator = (args.orchestrator as Address | undefined) ?? ORCH_ENV;
        if (!orchestrator) throw new Error('No orchestrator address — pass `orchestrator` or set MANDATE_ORCHESTRATOR_SA.');
        return text(
          buildMandateRequest({
            delegatorSmartAccount: delegator,
            orchestrator,
            board: args.board as Address | undefined,
            maxVotes: typeof args.maxVotes === 'number' ? args.maxVotes : undefined,
            ttlDays: typeof args.ttlDays === 'number' ? args.ttlDays : undefined,
            nowSec: Math.floor(Date.now() / 1000),
          }),
        );
      }
      throw new Error(`Unknown tool: ${name}`);
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });

  await server.connect(new StdioServerTransport());
  console.error('mandate-governance MCP server running on stdio');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
