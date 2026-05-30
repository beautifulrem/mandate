/**
 * @mandate/analyst — runs Venice-TEE analysis and maps the decision to an OZ support code.
 * The Venice client + redemption land in later tasks; for now it consumes the shared
 * support/decision contract so the seam is type-checked.
 */
import { SUPPORT, supportToDecision, type Decision, type Support, type VeniceTrace } from '@mandate/shared';

/** Decision label for a support code, used when assembling the VeniceTrace. */
export function decisionFor(support: Support): Decision {
  return supportToDecision(support);
}

export { SUPPORT };
export type { VeniceTrace };
