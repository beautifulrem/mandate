/**
 * @mandate/app — frontend entry. The grant flow + authority graph land in later tasks;
 * for now it consumes the shared contract so the app<->orchestrator seam is type-checked.
 */
import { GrantRequestSchema, type GrantRequest, type RunStatus } from '@mandate/shared';

/** Validate a grant payload before POSTing it to the orchestrator. */
export function validateGrant(payload: unknown): GrantRequest {
  return GrantRequestSchema.parse(payload);
}

/** The state badge text the UI shows for a run. */
export function runStateLabel(status: RunStatus): RunStatus['status'] {
  return status.status;
}
