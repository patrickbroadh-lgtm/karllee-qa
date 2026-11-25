/**
 * Fail closed before staging smoke tests create immutable inspection/evidence.
 * These must be dedicated test users: no A/B cross-memberships are allowed.
 */
export function assertStagingFixtureRoles({ orgA, orgB, inspectorA, viewerA, managerB }) {
  if (typeof orgA !== 'string' || typeof orgB !== 'string' || orgA === orgB) {
    throw new Error('Staging organisations must be two different IDs.');
  }
  const fixtures = [
    ['inspector A', inspectorA, orgA, ['inspector']],
    ['viewer A', viewerA, orgA, ['viewer']],
    ['manager B', managerB, orgB, ['site_manager', 'admin', 'director']],
  ];
  for (const [label, memberships, expectedOrg, allowedRoles] of fixtures) {
    if (!Array.isArray(memberships) || memberships.length !== 1) {
      throw new Error(`Staging ${label} must have exactly one A/B membership, with no cross-org membership.`);
    }
    const member = memberships[0];
    if (member?.organisation_id !== expectedOrg || member.active !== true
        || !allowedRoles.includes(member.role)) {
      throw new Error(`Staging ${label} must have an active membership in the expected organisation and role.`);
    }
  }
  return true;
}
