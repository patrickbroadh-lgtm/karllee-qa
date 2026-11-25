import type { StageNumber } from './project-types';

/**
 * Transcribed from Karllee Construction's QA Folder Rev A.
 * Reference prompts: some checks still require separate photo, witness,
 * certificate or signature evidence before production acceptance.
 */
export const QA_STAGE_TEMPLATES: Record<StageNumber, { title: string; checks: readonly string[] }> = {
  1: {
    title: 'Pre-Start & Compliance',
    checks: [
      'Construction Drawings & Specifications Received',
      'Planning Conditions Reviewed',
      'Building Control Approval in Place',
      'Warranty Provider Acceptance Confirmed',
      'Setting Out & Datum Confirmed',
    ],
  },
  2: {
    title: 'Groundworks & Substructure',
    checks: [
      'Excavations Inspected Prior to Pour — photos saved to Dropbox folder',
      'Foundations Poured',
      'Below-Ground Drainage Air / Water Test Carried Out (Witnessed)',
      'Substructure to DPC Completed',
      'DPC & DPM Installed and Continuous',
    ],
  },
  3: {
    title: 'Superstructure & Masonry',
    checks: [
      'External Cavity Walls Constructed to Drawings',
      'Wall Ties & Insulation Installed Correctly',
      'Cavities Kept Clear Throughout Construction (signature/date required)',
      'Lintels, Trays & Weep Vents Installed',
    ],
  },
  4: {
    title: 'Floors & Roof Structure',
    checks: [
      'First Floor Joists Installed & Restrained',
      'Stair Openings Formed Correctly',
      'Roof Structure Installed & Braced',
      'Fascia/Soffit/Barge boards installed to correct upstands for coverings',
    ],
  },
  5: {
    title: 'Roof Coverings & External Envelope',
    checks: [
      'Eaves Tray, Rafter Roll, Underlay, Battens & Roof Covering Installed',
      'Windows & External Doors Installed and Sealed',
    ],
  },
  6: {
    title: 'First Fix Services',
    checks: [
      'First Fix Plumbing Installed, Pressure Tested and Witnessed (signature/date required)',
      'First Fix Electrical Installed',
      'Fire Stopping to Penetrations Completed (signature/date required)',
    ],
  },
  7: {
    title: 'Insulation, Linings & Plastering',
    checks: [
      'Wall & Roof Insulation Installed',
      'Vapour Control Layer Installed',
      'Plasterboarding complete and snag free (socket not overcut)',
      'Plasterboarding complete and snagged',
    ],
  },
  8: {
    title: 'Second Fix & Internal Finishes',
    checks: [
      'Second Fix Plumbing Completed',
      'Second Fix Electrical Completed',
      'Internal Joinery, Kitchens & Bathrooms Completed',
    ],
  },
  9: {
    title: 'External Works',
    checks: [
      'Drainage Final Connections Completed',
      'Paths, Drives & Levels Completed',
    ],
  },
  10: {
    title: 'Testing, Certification & Energy Compliance',
    checks: [
      'Electrical Installation Certificate Received (EIC to be filed)',
      'Gas Safe / Heating Certificate Received (Gas Safe / commissioning certificate to be filed)',
      'Air Source Heat Pump / Solar PV Installed (if applicable; MCS / commissioning certificate to be filed)',
      'Air Tightness Test Completed (air test report to be filed)',
      'EPC Completed (EPC to be filed)',
    ],
  },
  11: {
    title: 'Appliance Warranties & Manuals',
    checks: [
      'Oven Warranty Collected & Filed',
      'Hob Warranty Collected & Filed',
      'Dishwasher Warranty Collected & Filed',
      'Washing Machine Warranty Collected & Filed',
      'Tumble Dryer Warranty Collected & Filed',
      'Site Manager Signature / Date',
    ],
  },
  12: {
    title: 'Final Inspections & Handover',
    checks: [
      'Building Control Final Certificate Received (completion certificate to be filed)',
      'Warranty Provider Final Certificate Received (final warranty certificate to be filed)',
      'Snagging Completed',
      'QA Folder Complete and Checked Prior to Handover',
      'Signed for Karllee Construction / Date',
    ],
  },
};
