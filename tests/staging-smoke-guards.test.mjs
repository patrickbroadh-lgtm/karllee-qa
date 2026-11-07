import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStagingTarget } from '../scripts/staging-smoke-guards.mjs';

const ref = 'abcdefghijklmnopqrst';
const safe = {
  url: `https://${ref}.supabase.co`,
  projectRef: ref,
  acknowledgement: 'STAGING_ONLY_ACCEPT_TEST_RECORDS',
};

test('allows only explicitly acknowledged exact staging project', () => {
  assert.equal(assertStagingTarget(safe), `https://${ref}.supabase.co`);
  assert.equal(assertStagingTarget({ ...safe, url: safe.url + '/' }), safe.url);
});

test('refuses missing acknowledgement and invalid project reference', () => {
  assert.throws(() => assertStagingTarget({ ...safe, acknowledgement: '' }), /STAGING_WRITE_ACK/);
  assert.throws(() => assertStagingTarget({ ...safe, projectRef: 'production' }), /STAGING_PROJECT_REF/);
});

test('refuses a different Supabase project, localhost and non-Supabase domains', () => {
  for (const url of [
    'https://zyxwvutsrqponmlkjihg.supabase.co',
    'https://localhost',
    'https://supabase.co',
    `http://${ref}.supabase.co`,
    `https://${ref}.supabase.co.evil.example`,
    `https://user:password@${ref}.supabase.co`,
    `https://${ref}.supabase.co:8443`,
    `https://${ref}.supabase.co/path`,
    `https://${ref}.supabase.co/?debug=1`,
  ]) {
    assert.throws(() => assertStagingTarget({ ...safe, url }));
  }
});
