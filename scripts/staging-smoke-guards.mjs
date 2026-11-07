/** Fail-closed guard for opt-in hosted Supabase staging smoke tests. */
export function assertStagingTarget({ url, projectRef, acknowledgement }) {
  if (acknowledgement !== 'STAGING_ONLY_ACCEPT_TEST_RECORDS') {
    throw new Error('Set STAGING_WRITE_ACK=STAGING_ONLY_ACCEPT_TEST_RECORDS to acknowledge test writes.');
  }
  if (typeof projectRef !== 'string' || !/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error('STAGING_PROJECT_REF must be the 20-character staging project reference.');
  }
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid staging Supabase URL.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${projectRef}.supabase.co`
      || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/'
      || parsed.search || parsed.hash) {
    throw new Error('Staging URL must exactly match https://STAGING_PROJECT_REF.supabase.co/.');
  }
  return parsed.origin;
}
