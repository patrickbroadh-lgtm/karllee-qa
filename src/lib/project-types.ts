export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';
export type PlotStatus = 'not_started' | 'under_construction' | 'complete';
export type InspectionResult = 'draft' | 'pass' | 'fail' | 'not_applicable';
export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface ProjectRecord {
  id: string;
  organisation_id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
}
export interface PlotRecord {
  id: string;
  project_id: string;
  plot_number: string;
  description: string | null;
  status: PlotStatus;
}
export interface InspectionRecord {
  id: string;
  plot_id: string;
  stage_number: StageNumber;
  attempt: number;
  result: InspectionResult;
  notes: string | null;
  inspected_at: string | null;
  created_by: string;
}
