/**
 * Demo seed: a lived-in fake agency ("Pine Haven Hospice") so the app can be
 * demoed to hospice agencies without touching real PHI.
 *
 * Run:  DATABASE_URL=... npx tsx scripts/seed-demo.ts
 * Re-run any time: it wipes the previous demo tenant and reseeds fresh.
 *
 * Demo logins (SMS is bypassed for the demo — use this code):
 *   code 123456 works for every demo phone number below.
 */
import postgres from "postgres";
import { createHash } from "node:crypto";

const DB = process.env.DATABASE_URL ?? "postgres://hospice:hospice@127.0.0.1:5433/hospice";
const sql = postgres(DB);
const hash = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

const DEMO_CODE = "123456";
const AGENCY = "Pine Haven Hospice";
/** Clearly-fake 555 numbers — never real phones. */
const P = {
  admin: "+15550001001",
  rn: "+15550001002",
  msw: "+15550001003",
  maria: "+15550001004", // Eleanor's daughter (caregiver)
  james: "+15550001005", // Robert's son (caregiver)
  margaret: "+15550001006", // Margaret logs in directly (patient)
};

async function wipe() {
  const t = await sql`select id from tenants where agency_name = ${AGENCY}`;
  for (const { id } of t) {
    await sql`delete from audit_log where tenant_id = ${id}`;
    await sql`delete from visit_notes where tenant_id = ${id}`;
    await sql`delete from sia_entries where tenant_id = ${id}`;
    await sql`delete from idg_sessions where tenant_id = ${id}`;
    await sql`delete from alerts where tenant_id = ${id}`;
    await sql`delete from questionnaire_responses where tenant_id = ${id}`;
    await sql`delete from questionnaire_assignments where tenant_id = ${id}`;
    await sql`delete from messages where tenant_id = ${id}`;
    await sql`delete from thread_reads where thread_id in (select id from threads where tenant_id = ${id})`;
    await sql`delete from thread_participants where thread_id in (select id from threads where tenant_id = ${id})`;
    await sql`delete from threads where tenant_id = ${id}`;
    await sql`delete from visits where tenant_id = ${id}`;
    await sql`delete from enrollments where patient_id in (select id from patients where tenant_id = ${id})`;
    await sql`delete from patients where tenant_id = ${id}`;
    await sql`delete from sessions where tenant_id = ${id}`;
    await sql`delete from verification_codes where phone in (${P.admin},${P.rn},${P.msw},${P.maria},${P.james},${P.margaret})`;
    await sql`delete from users where tenant_id = ${id}`;
    await sql`delete from tenants where id = ${id}`;
  }
}

async function main() {
  await wipe();

  const tenantId = (
    await sql`insert into tenants (agency_name, primary_color, care_line_phone)
      values (${AGENCY}, '#0E7C6B', '+15550001999') returning id`
  )[0].id;

  const mkUser = async (role: string, name: string, phone: string) =>
    (
      await sql`insert into users (tenant_id, role, display_name, phone)
        values (${tenantId}, ${role}, ${name}, ${phone}) returning id`
    )[0].id;

  const admin = await mkUser("admin", "Dana Director", P.admin);
  const rn = await mkUser("clinician", "Rita RN", P.rn);
  const msw = await mkUser("clinician", "Sam Social Worker", P.msw);
  const maria = await mkUser("caregiver", "Maria Garcia (daughter)", P.maria);
  const james = await mkUser("caregiver", "James Carter (son)", P.james);
  const margaretUser = await mkUser("patient", "Margaret Lin", P.margaret);

  // Demo login codes (far-future expiry; single use each — reseed to refresh).
  for (const phone of Object.values(P)) {
    await sql`insert into verification_codes (phone, code_hash, expires_at, attempts)
      values (${phone}, ${hash(DEMO_CODE)}, ${new Date("2030-01-01")}, 0)`;
  }

  const mkPatient = async (name: string, mrn: string, dob: string, userId: string | null) =>
    (
      await sql`insert into patients (tenant_id, display_name, mrn, date_of_birth, user_id)
        values (${tenantId}, ${name}, ${mrn}, ${dob}, ${userId}) returning id`
    )[0].id;

  const eleanor = await mkPatient("Eleanor Vance", "PH-1001", "1938-04-12", null);
  const robert = await mkPatient("Robert Hale", "PH-1002", "1941-09-03", null);
  const margaret = await mkPatient("Margaret Lin", "PH-1003", "1935-12-25", margaretUser);

  await sql`insert into enrollments (patient_id, caregiver_user_id) values (${eleanor}, ${maria})`;
  await sql`insert into enrollments (patient_id, caregiver_user_id) values (${robert}, ${james})`;

  // --- Questionnaires: Eleanor's ESAS this morning, pain 8/10 -> RED alert
  const esasAssignment = (
    await sql`insert into questionnaire_assignments (tenant_id, patient_id, kind, status, completed_at)
      values (${tenantId}, ${eleanor}, 'esas', 'completed', ${new Date(Date.now() - 2 * 36e5)}) returning id`
  )[0].id;
  const esasResponse = (
    await sql`insert into questionnaire_responses (tenant_id, patient_id, kind, scores, submitted_by, assignment_id, submitted_at)
      values (${tenantId}, ${eleanor}, 'esas',
        ${sql.json({ pain: 8, tiredness: 7, drowsiness: 4, nausea: 2, appetite: 5, shortnessOfBreath: 3, depression: 4, anxiety: 6, wellbeing: 7 })},
        ${maria}, ${esasAssignment}, ${new Date(Date.now() - 2 * 36e5)}) returning id`
  )[0].id;
  await sql`insert into alerts (tenant_id, patient_id, response_id, kind, symptom, score, severity, message, acknowledged, created_at)
    values (${tenantId}, ${eleanor}, ${esasResponse}, 'esas', 'pain', 8, 'red',
      'Pain 8/10 reported on ESAS — above the red-flag threshold.', false, ${new Date(Date.now() - 2 * 36e5)})`;

  // Robert: stable PPS, no alerts
  const ppsAssignment = (
    await sql`insert into questionnaire_assignments (tenant_id, patient_id, kind, status, completed_at)
      values (${tenantId}, ${robert}, 'pps', 'completed', ${new Date(Date.now() - 26 * 36e5)}) returning id`
  )[0].id;
  await sql`insert into questionnaire_responses (tenant_id, patient_id, kind, scores, submitted_by, assignment_id, submitted_at)
    values (${tenantId}, ${robert}, 'pps', ${sql.json({ ambulation: 3, activity: 3, selfCare: 3, intake: 3, consciousness: 3 })},
      ${james}, ${ppsAssignment}, ${new Date(Date.now() - 26 * 36e5)})`;

  // Margaret: ESAS pending (shows the send-schedule flow)
  await sql`insert into questionnaire_assignments (tenant_id, patient_id, kind, status, due_at)
    values (${tenantId}, ${margaret}, 'esas', 'pending', ${new Date(Date.now() + 20 * 36e5)})`;

  // --- Messaging: Maria -> team about Eleanor's pain (1 unread for the team)
  const thread = (
    await sql`insert into threads (tenant_id, patient_id) values (${tenantId}, ${eleanor}) returning id`
  )[0].id;
  for (const u of [maria, rn, admin]) {
    await sql`insert into thread_participants (thread_id, user_id) values (${thread}, ${u})`;
  }
  const msg = async (sender: string, dir: string, body: string, minsAgo: number) =>
    sql`insert into messages (tenant_id, thread_id, sender_id, direction, body, sent_at)
      values (${tenantId}, ${thread}, ${sender}, ${dir}, ${body}, ${new Date(Date.now() - minsAgo * 6e4)})`;
  await msg(maria, "family_to_team", "Hi, this is Maria — Mom's pain is worse this morning, the morning meds didn't seem to help.", 95);
  await msg(rn, "team_to_family", "Hi Maria, this is Rita, her nurse. I'm sorry to hear that. Can you tell me where the pain is and what it feels like right now?", 80);
  await msg(maria, "family_to_team", "It's in her lower back, sharp when she moves. She just filled out the questionnaire too.", 70);
  // team hasn't read Maria's last message -> unread badge in the demo
  await sql`insert into thread_reads (thread_id, user_id, last_read_at) values (${thread}, ${rn}, ${new Date(Date.now() - 75 * 6e4)})`;
  await sql`insert into thread_reads (thread_id, user_id, last_read_at) values (${thread}, ${admin}, ${new Date(Date.now() - 75 * 6e4)})`;
  await sql`insert into thread_reads (thread_id, user_id, last_read_at) values (${thread}, ${maria}, ${new Date()})`;

  // --- Visits
  const yesterday = new Date(Date.now() - 24 * 36e5);
  const tomorrow = new Date(Date.now() + 24 * 36e5);
  const nextWeek = new Date(Date.now() + 6 * 24 * 36e5);

  const v1 = (
    await sql`insert into visits (tenant_id, patient_id, clinician_id, visit_type, status, scheduled_at)
      values (${tenantId}, ${eleanor}, ${rn}, 'in_person', 'completed', ${yesterday}) returning id`
  )[0].id;
  // SIA: 45 in-person RN minutes -> 3 units
  await sql`insert into sia_entries (tenant_id, visit_id, clinician_role, minutes, occurred_at)
    values (${tenantId}, ${v1}, 'rn', 45, ${yesterday})`;
  // Draft note on that visit — demo the approve -> file flow live
  await sql`insert into visit_notes (tenant_id, visit_id, patient_id, transcript, sections, status, created_by)
    values (${tenantId}, ${v1}, ${eleanor},
      'Rita: Hi Eleanor, how is the pain today? Eleanor: Better after the morning meds, maybe a 4 now. Rita: Good — we will keep the current plan and I will check in tomorrow.',
      ${sql.json({
        summary: "Routine RN visit. Pain improved from morning report after medication.",
        observations: "Patient alert, comfortable at rest. Pain 4/10 after meds.",
        interventions: "Medication review, repositioning education for Maria.",
        plan: "Continue current pain regimen. Reassess tomorrow.",
        followUp: "Phone check-in tomorrow morning.",
      })},
      'draft', ${rn})`;

  await sql`insert into visits (tenant_id, patient_id, clinician_id, visit_type, status, scheduled_at)
    values (${tenantId}, ${margaret}, ${rn}, 'video', 'scheduled', ${tomorrow})`;
  await sql`insert into visits (tenant_id, patient_id, clinician_id, visit_type, status, scheduled_at)
    values (${tenantId}, ${robert}, ${msw}, 'in_person', 'scheduled', ${nextWeek})`;

  // --- IDG next week
  await sql`insert into idg_sessions (tenant_id, scheduled_at, status, attendees, created_by)
    values (${tenantId}, ${nextWeek}, 'scheduled',
      ${sql.json([
        { name: "Rita RN", role: "RN" },
        { name: "Sam Social Worker", role: "MSW" },
        { name: "Dana Director", role: "Administrator" },
      ])}, ${admin})`;

  console.log(`
Demo seeded: ${AGENCY}
================================================================
Log in with any phone below + code ${DEMO_CODE} (demo bypasses SMS).

  TEAM (care-team app / web dashboard)
    Dana Director (admin) .... ${P.admin}
    Rita RN (clinician) ...... ${P.rn}
    Sam Social Worker ........ ${P.msw}

  FAMILY (family app)
    Maria Garcia (caregiver) . ${P.maria}   -> daughter of Eleanor Vance
    James Carter (caregiver) . ${P.james}    -> son of Robert Hale
    Margaret Lin (patient) ... ${P.margaret} -> logs in directly

WHAT TO SHOW
  1. Alerts inbox  -> Eleanor's RED pain alert (unacknowledged). One-tap acknowledge.
  2. Messaging .... -> Maria's thread, 1 unread. Reply as Rita.
  3. Visits ....... -> yesterday's completed visit w/ SIA units + DRAFT note
                       (approve -> file it live); tomorrow's video visit (Margaret).
  4. Dashboard .... -> sign in on the web as Dana (admin): alerts + audit trail.
  5. IDG .......... -> scheduled session w/ attendee list (consent-gated).

Re-run this script any time for a fresh demo world.
`);
  await sql.end();
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
