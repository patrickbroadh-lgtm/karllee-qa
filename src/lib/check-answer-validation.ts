/** Validates one immutable QA checklist submission before it is persisted. */
export type CheckResult = 'pass' | 'fail' | 'not_applicable';

export type CheckAnswerInput = {
  check_number: number;
  result: CheckResult;
  notes?: string | null;
};

export type ValidatedCheckAnswer = {
  check_number: number;
  check_text: string;
  result: CheckResult;
  notes: string | null;
};

/**
 * The complete checklist is required; a stage must not be marked passed
 * while some individual checks are unrecorded. The text is snapshotted so
 * later template revisions cannot rewrite historical inspection evidence.
 */
export function validateCheckAnswers(
  checks: readonly string[],
  answers: readonly CheckAnswerInput[],
): ValidatedCheckAnswer[] {
  if (checks.length === 0 || checks.some((check) => !check.trim())) {
    throw new Error('A non-empty checklist template is required.');
  }
  if (answers.length !== checks.length) {
    throw new Error('Every checklist item must have a result.');
  }

  const seen = new Set<number>();
  const validated = answers.map((answer) => {
    const number = answer.check_number;
    if (!Number.isInteger(number) || number < 1 || number > checks.length || seen.has(number)) {
      throw new Error('Invalid or duplicate checklist item number.');
    }
    seen.add(number);
    if (!['pass', 'fail', 'not_applicable'].includes(answer.result)) {
      throw new Error('Invalid checklist result.');
    }
    const notes = answer.notes?.trim() || null;
    if (answer.result === 'fail' && !notes) {
      throw new Error(`Checklist item ${number} requires a defect description.`);
    }
    return {
      check_number: number,
      check_text: checks[number - 1],
      result: answer.result,
      notes,
    };
  });
  return validated.sort((a, b) => a.check_number - b.check_number);
}

export function overallCheckResult(answers: readonly ValidatedCheckAnswer[]): CheckResult {
  if (answers.length === 0) throw new Error('Cannot submit an empty checklist.');
  if (answers.some((answer) => answer.result === 'fail')) return 'fail';
  if (answers.every((answer) => answer.result === 'not_applicable')) return 'not_applicable';
  return 'pass';
}
