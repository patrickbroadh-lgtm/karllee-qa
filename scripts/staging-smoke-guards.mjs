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

/** Reject privileged credentials before any network request or test write.
 * Supabase publishable keys start sb_publishable_; legacy anon keys are JWTs
 * whose role claim must be anon. This check is defence-in-depth, not auth.
 */
export function assertPublicStagingKey(key) {
  if (typeof key !== 'string' || !key.trim() || key !== key.trim()) {
    throw new Error('STAGING_PUBLISHABLE_KEY must be a nonempty public key.');
  }
  if (key.startsWith('sb_publishable_') && key.length > 'sb_publishable_'.length) return key;
  if (key.startsWith('sb_secret_') || key.startsWith('service_role')) {
    throw new Error('Privileged Supabase keys are forbidden in staging smoke tests.');
  }
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload && payload.role === 'anon') return key;
    } catch { /* malformed legacy key */ }
  }
  throw new Error('STAGING_PUBLISHABLE_KEY must be a publishable key or legacy anon JWT, never service_role.');
}
