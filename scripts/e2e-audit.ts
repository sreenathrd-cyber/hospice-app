/* Feature 8 e2e: audit-trail viewer. Run with: node --experimental-strip-types scripts/e2e-audit.ts
 * (falls back to tsx if available). API must be up on PORT. */
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

const DB = "postgres://hospice:hospice@127.0.0.1:5433/hospice";
const BASE = `http://127.0.0.1:${process.env.PORT ?? 3100}/api/v1`;
const sql = postgres(DB);

const hash = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function main() {
  // --- fixtures: two tenants, admin+clinician+caregiver in tenant A, admin in tenant B
  const tA = (await sql`insert into tenants (agency_name, primary_color) values ('Audit Test A', '#0B5FFF') returning id`)[0].id;
  const tB = (await sql`insert into tenants (agency_name, primary_color) values ('Audit Test B', '#0B5FFF') returning id`)[0].id;
  const mkUser = async (tenant: string, role: string, name: string, phone: string) =>
    (await sql`insert into users (tenant_id, role, display_name, phone)
       values (${tenant}, ${role}, ${name}, ${phone}) returning id`)[0].id;
  const adminA = await mkUser(tA, "admin", "Alice Admin", "+10000000001");
  const clinA = await mkUser(tA, "clinician", "Cara Clinician", "+10000000002");
  const cgA = await mkUser(tA, "caregiver", "Gus Caregiver", "+10000000003");
  const adminB = await mkUser(tB, "admin", "Bob Admin", "+10000000004");

  const mint = async (userId: string, tenant: string) => {
    const token = randomBytes(32).toString("hex");
    await sql`insert into sessions (token_hash, user_id, tenant_id, expires_at)
      values (${hash(token)}, ${userId}, ${tenant}, ${new Date(Date.now() + 864e5)})`;
    return token;
  };
  const tokAdminA = await mint(adminA, tA);
  const tokClinA = await mint(clinA, tA);
  const tokCgA = await mint(cgA, tA);
  const tokAdminB = await mint(adminB, tB);

  console.log("1. login writes an audit row");
  // seed a verification code directly, then verify-code through HTTP
  const code = "424242";
  await sql`insert into verification_codes (phone, code_hash, expires_at, attempts)
    values ('+10000000005', ${hash(code)}, ${new Date(Date.now() + 6e5)}, 0)`;
  const loginUser = await mkUser(tA, "clinician", "Liam Login", "+10000000005");
  const vr = await fetch(`${BASE}/auth/verify-code`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+10000000005", code }),
  });
  check("verify-code 201", vr.status === 201, `got ${vr.status}`);
  const loginRows = await sql`select action, record_type from audit_log
    where tenant_id = ${tA} and actor_id = ${loginUser} and action = 'login'`;
  check("login audit row written", loginRows.length === 1 && loginRows[0].record_type === "user");

  console.log("2. PHI reads write audit rows");
  await fetch(`${BASE}/threads`, { headers: auth(tokClinA) });
  await fetch(`${BASE}/alerts`, { headers: auth(tokClinA) });
  await fetch(`${BASE}/visits`, { headers: auth(tokClinA) });
  const reads = await sql`select record_type, record_id from audit_log
    where tenant_id = ${tA} and actor_id = ${clinA} and action = 'view' order by created_at`;
  const types = reads.map((r) => r.record_type);
  check("thread list logged", types.includes("thread"));
  check("alerts logged", types.includes("alert"));
  check("visits logged", types.includes("visit"));
  check("record ids present, no PHI", reads.every((r) => r.record_id && !r.record_id.includes("@")));

  console.log("3. admin can query the trail");
  const q1 = await fetch(`${BASE}/admin/audit-log?limit=50`, { headers: auth(tokAdminA) });
  check("admin 200", q1.status === 200, `got ${q1.status}`);
  const entries = await q1.json();
  check("entries newest-first", entries.length > 0 && entries[0].createdAt >= entries[entries.length - 1].createdAt);
  check("actor names joined", entries.every((e: any) => typeof e.actorName === "string" && e.actorName.length > 0));
  check("entry shape valid", entries.every((e: any) => e.id && e.tenantId === tA && e.action && e.recordType && e.createdAt));

  console.log("4. filters work");
  const qf = await fetch(`${BASE}/admin/audit-log?recordType=alert`, { headers: auth(tokAdminA) });
  const fEntries = await qf.json();
  check("recordType filter", qf.status === 200 && fEntries.length > 0 && fEntries.every((e: any) => e.recordType === "alert"));

  console.log("5. RBAC: non-admins blocked");
  const qc = await fetch(`${BASE}/admin/audit-log`, { headers: auth(tokClinA) });
  check("clinician gets 403", qc.status === 403, `got ${qc.status}`);
  const qg = await fetch(`${BASE}/admin/audit-log`, { headers: auth(tokCgA) });
  check("caregiver gets 403", qg.status === 403, `got ${qg.status}`);
  const qn = await fetch(`${BASE}/admin/audit-log`);
  check("anonymous gets 401", qn.status === 401, `got ${qn.status}`);

  console.log("6. tenant isolation");
  await fetch(`${BASE}/threads`, { headers: auth(tokAdminB) }); // writes a tenant-B row
  const qa = await fetch(`${BASE}/admin/audit-log?limit=200`, { headers: auth(tokAdminA) });
  const aEntries = await qa.json();
  check("no cross-tenant rows", aEntries.every((e: any) => e.tenantId === tA));
  const qb = await fetch(`${BASE}/admin/audit-log?limit=200`, { headers: auth(tokAdminB) });
  const bEntries = await qb.json();
  check("tenant B sees own rows", bEntries.length > 0 && bEntries.every((e: any) => e.tenantId === tB));

  console.log("7. append-only: no update/delete route");
  const someId = entries[0].id;
  const pu = await fetch(`${BASE}/admin/audit-log/${someId}`, { method: "PATCH", headers: { ...auth(tokAdminA), "Content-Type": "application/json" }, body: "{}" });
  check("PATCH not routed", pu.status === 404, `got ${pu.status}`);
  const dl = await fetch(`${BASE}/admin/audit-log/${someId}`, { method: "DELETE", headers: auth(tokAdminA) });
  check("DELETE not routed", dl.status === 404, `got ${dl.status}`);
  const stillThere = await sql`select 1 from audit_log where id = ${someId}`;
  check("row still present", stillThere.length === 1);

  // cleanup fixtures
  await sql`delete from audit_log where tenant_id in (${tA}, ${tB})`;
  await sql`delete from sessions where tenant_id in (${tA}, ${tB})`;
  await sql`delete from users where tenant_id in (${tA}, ${tB})`;
  await sql`delete from tenants where id in (${tA}, ${tB})`;

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
