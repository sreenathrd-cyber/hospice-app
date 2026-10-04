/**
 * One-time agency bootstrap. Creates the tenant and its first admin user.
 *
 * Run:  SEED_TENANT_NAME="Pine Haven Hospice" SEED_ADMIN_PHONE="+12695550134" \
 *       SEED_ADMIN_NAME="Admin" npx tsx src/seed.ts
 *
 * Idempotent on the admin phone number — safe to re-run. This is an ops tool,
 * not an endpoint: there is deliberately no HTTP route that creates users.
 */
import { eq } from "@repo/db";
import { createDb, tenants, users } from "@repo/db";

async function main(): Promise<void> {
  const tenantName = process.env.SEED_TENANT_NAME;
  const adminPhone = process.env.SEED_ADMIN_PHONE;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Agency Admin";
  const databaseUrl = process.env.DATABASE_URL;

  if (!tenantName || !adminPhone || !databaseUrl) {
    throw new Error("Set SEED_TENANT_NAME, SEED_ADMIN_PHONE, and DATABASE_URL");
  }

  const db = createDb(databaseUrl);

  const existing = await db.query.users.findFirst({ where: eq(users.phone, adminPhone) });
  if (existing) {
    console.log(`User ${adminPhone} already exists — nothing to do.`);
    return;
  }

  const [tenant] = await db
    .insert(tenants)
    .values({ agencyName: tenantName, primaryColor: "#1F6F5B" })
    .returning();
  if (!tenant) throw new Error("Failed to create tenant");

  await db.insert(users).values({
    tenantId: tenant.id,
    role: "admin",
    displayName: adminName,
    phone: adminPhone,
  });
  console.log(`Created tenant "${tenantName}" with admin ${adminPhone}.`);
}

void main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
