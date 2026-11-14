import type { InspectionRecord, StageNumber } from './project-types';

/** Read-only snapshot of an individual answer as recorded at inspection time. */
export type ChecklistAnswerRecord = {
  inspection_id: string;
  check_number: number;
  check_text: string;
  result: 'pass' | 'fail' | 'not_applicable';
  notes: string | null;
};

/** Sort by attempt, not inspection date: the server allocates attempts atomically. */
export function stageAttemptHistory(
  inspections: readonly InspectionRecord[],
  stage: StageNumber,
): InspectionRecord[] {
  return inspections
    .filter((record) => record.stage_number === stage)
    .sort((a, b) => b.attempt - a.attempt);
}

/** Do not infer checklist answers from an old stage-only result. */
export function inspectionAnswers(
  answers: readonly ChecklistAnswerRecord[],
  inspectionId: string,
): ChecklistAnswerRecord[] {
  return answers
    .filter((answer) => answer.inspection_id === inspectionId)
    .sort((a, b) => a.check_number - b.check_number);
}

export function answerSummary(answers: readonly ChecklistAnswerRecord[]): {
  passed: number;
  failed: number;
  notApplicable: number;
} {
  return {
    passed: answers.filter((answer) => answer.result === 'pass').length,
    failed: answers.filter((answer) => answer.result === 'fail').length,
    notApplicable: answers.filter((answer) => answer.result === 'not_applicable').length,
  };
}
