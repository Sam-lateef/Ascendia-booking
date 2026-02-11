#!/usr/bin/env node
/**
 * Inspect first org (by created_at) and its members.
 * Run: node scripts/inspect-first-org-and-users.js
 * Requires: .env with SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log('\n=== 1. First org (by created_at) ===\n');

  const { data: firstOrg, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at, status, is_system_org')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgErr) {
    console.error('Error fetching org:', orgErr.message);
    process.exit(1);
  }
  if (!firstOrg) {
    console.log('No organizations found.');
    process.exit(0);
  }

  console.table([firstOrg]);
  const orgId = firstOrg.id;

  console.log('\n=== 2. Members of first org ===\n');

  const { data: members, error: membersErr } = await supabase
    .from('organization_members')
    .select('id, role, status, user_id')
    .eq('organization_id', orgId)
    .order('role', { ascending: true });

  if (membersErr) {
    console.error('Error fetching members:', membersErr.message);
    process.exit(1);
  }

  const userIds = [...new Set((members || []).map(m => m.user_id).filter(Boolean))];
  let usersMap = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, email, first_name, last_name').in('id', userIds);
    usersMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
  }

  const rows = (members || []).map(m => {
    const u = usersMap[m.user_id] || {};
    return {
      member_id: m.id,
      role: m.role,
      status: m.status,
      user_id: m.user_id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
    };
  });
  console.table(rows);

  console.log('\n=== 3. Summary ===\n');
  console.log(JSON.stringify({ first_org_id: orgId, is_system_org: firstOrg.is_system_org }, null, 2));
  console.log('');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
