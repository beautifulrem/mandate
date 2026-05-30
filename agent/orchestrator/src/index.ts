/**
 * @mandate/orchestrator — holds the root delegation context and serves the run-status API.
 * The redelegation + autonomous loop land in later tasks; for now it validates grants
 * against the shared contract so the seam is type-checked.
 */
import { GrantRequestSchema, RunStatusEnum, type GrantRequest, type RunState } from '@mandate/shared';

/** Parse + validate an incoming grant from the app. */
export function parseGrant(payload: unknown): GrantRequest {
  return GrantRequestSchema.parse(payload);
}

/** The ordered run lifecycle this service drives. */
export const RUN_STATES: readonly RunState[] = RunStatusEnum.options;
