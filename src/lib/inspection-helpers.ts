import type { InspectionRecord, InspectionResult, StageNumber } from './project-types';

/** The QA workflow contains twelve ordered construction stages. */
export const STAGE_NUMBERS: readonly StageNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function latestAttempt(
  inspections: readonly InspectionRecord[],
  stage: StageNumber,
): InspectionRecord | undefined {
  return inspections
    .filter((inspection) => inspection.stage_number === stage)
    .reduce<InspectionRecord | undefined>(
      (latest, inspection) => (!latest || inspection.attempt > latest.attempt ? inspection : latest),
      undefined,
    );
}

export function nextAttempt(inspections: readonly InspectionRecord[], stage: StageNumber): number {
  return (latestAttempt(inspections, stage)?.attempt ?? 0) + 1;
}

export function canRecordInspection(role: string | null | undefined): boolean {
  return role === 'director' || role === 'admin' || role === 'site_manager' || role === 'inspector';
}

export function inspectionResultLabel(result: InspectionResult): string {
  switch (result) {
    case 'pass': return 'Pass';
    case 'fail': return 'Fail';
    case 'not_applicable': return 'N/A';
    default: return 'Draft';
  }
}
