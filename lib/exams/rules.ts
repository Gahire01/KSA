/**
 * The exam rules every course is held to. One place, so the seed, the course form,
 * grading and the runner cannot drift apart.
 */

/** 50 passes, 49 fails. */
export const PASS_MARK_PCT = 50;

/** Attempt 1 fails -> attempt 2 is issued automatically. The owner may grant more. */
export const MAX_ATTEMPTS = 2;

/** Every course gets the same one-hour paper. */
export const EXAM_DURATION_MIN = 60;

/**
 * The trainee may leave the exam window once (a warning). The second departure
 * ends the sitting as FAILED whatever the score.
 */
export const TAB_LEAVE_FAIL_AT = 2;

/**
 * Compared exactly, not on a rounded percentage: 99 of 200 is 49.5% and must not
 * round up into a pass on a 50% mark.
 */
export function isPass(correctCount: number, totalCount: number, passMarkPct: number): boolean {
  return totalCount > 0 && correctCount * 100 >= passMarkPct * totalCount;
}
