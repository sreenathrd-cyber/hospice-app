import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  desc,
  eq,
  gt,
  lt,
  ne,
  or,
  enrollments,
  messages,
  patients,
  tenants,
  threadParticipants,
  threadReads,
  threads,
  users,
  type Database,
} from "@repo/db";
import {
  isTeamRole,
  messageWithSenderSchema,
  threadListItemSchema,
  threadSchema,
  type MessagesQuery,
  type MessageWithSender,
  type Thread,
  type ThreadListItem,
} from "@repo/types";
import { DB_CLIENT } from "../db/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { RequestAuth } from "../tenant/tenant.guard.js";
import { resolveDirection } from "./messaging.logic.js";
import { PushService } from "./push.service.js";

/**
 * Care team ↔ family messaging. Every read and write is participant-checked
 * and tenant-scoped; misses return 404 so callers can't probe other tenants'
 * threads. Push notifications carry zero PHI (see PushService).
 */
@Injectable()
export class MessagingService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}

  /** Thread the caller may see, or null when it doesn't exist / isn't theirs. */
  private async visibleThread(auth: RequestAuth, threadId: string) {
    const thread = await this.db.query.threads.findFirst({
      where: and(eq(threads.id, threadId), eq(threads.tenantId, auth.tenantId)),
    });
    if (!thread) return null;
    const participation = await this.db.query.threadParticipants.findFirst({
      where: and(
        eq(threadParticipants.threadId, threadId),
        eq(threadParticipants.userId, auth.userId),
      ),
    });
    return participation ? thread : null;
  }

  private async requireVisibleThread(auth: RequestAuth, threadId: string) {
    const thread = await this.visibleThread(auth, threadId);
    if (!thread) {
      throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
    }
    return thread;
  }

  /** The patient's own login, an enrolled caregiver, or any team member. */
  private async callerMayOpenPatientThread(
    auth: RequestAuth,
    patientId: string,
  ): Promise<boolean> {
    if (isTeamRole(auth.role)) return true;
    const patient = await this.db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.tenantId, auth.tenantId)),
    });
    if (!patient) return false;
    if (patient.userId === auth.userId) return true;
    const enrollment = await this.db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.patientId, patientId),
        eq(enrollments.caregiverUserId, auth.userId),
      ),
    });
    return enrollment !== undefined;
  }

  /**
   * Open (or return the existing) conversation for a patient. The circle is
   * the family's enrolled caregivers + the patient's own login + every
   * clinician/admin of the agency — the care team for a pilot agency.
   */
  async createThread(auth: RequestAuth, patientId: string): Promise<Thread> {
    const patient = await this.db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.tenantId, auth.tenantId)),
    });
    if (!patient) {
      throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
    }
    if (!(await this.callerMayOpenPatientThread(auth, patientId))) {
      throw new ForbiddenException({ code: "forbidden", message: "Not your conversation" });
    }

    const existing = await this.db.query.threads.findFirst({
      where: and(eq(threads.patientId, patientId), eq(threads.tenantId, auth.tenantId)),
    });
    if (existing) return threadSchema.parse(toThreadDto(existing));

    const caregivers = await this.db
      .select({ userId: enrollments.caregiverUserId })
      .from(enrollments)
      .where(eq(enrollments.patientId, patientId));
    const team = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          or(eq(users.role, "clinician"), eq(users.role, "admin")),
        ),
      );

    const participantIds = new Set<string>([auth.userId]);
    for (const c of caregivers) participantIds.add(c.userId);
    if (patient.userId) participantIds.add(patient.userId);
    for (const m of team) participantIds.add(m.id);

    const [thread] = await this.db
      .insert(threads)
      .values({ tenantId: auth.tenantId, patientId })
      .returning();
    if (!thread) {
      throw new InternalServerErrorException({
        code: "thread_create_failed",
        message: "Couldn't start the conversation. Try again.",
      });
    }
    await this.db.insert(threadParticipants).values(
      [...participantIds].map((userId) => ({ threadId: thread.id, userId })),
    );
    return threadSchema.parse(toThreadDto(thread));
  }

  /** Threads the caller participates in, newest activity first. */
  async listThreads(auth: RequestAuth): Promise<ThreadListItem[]> {
    const mine = await this.db
      .select({ threadId: threadParticipants.threadId })
      .from(threadParticipants)
      .where(eq(threadParticipants.userId, auth.userId));

    const items: ThreadListItem[] = [];
    for (const { threadId } of mine) {
      const thread = await this.db.query.threads.findFirst({
        where: and(eq(threads.id, threadId), eq(threads.tenantId, auth.tenantId)),
      });
      if (!thread) continue;

      const parts = await this.db
        .select({ displayName: users.displayName, userId: users.id })
        .from(threadParticipants)
        .innerJoin(users, eq(threadParticipants.userId, users.id))
        .where(eq(threadParticipants.threadId, threadId));

      const last = await this.db.query.messages.findFirst({
        where: eq(messages.threadId, threadId),
        orderBy: [desc(messages.sentAt), desc(messages.id)],
      });

      const read = await this.db.query.threadReads.findFirst({
        where: and(eq(threadReads.threadId, threadId), eq(threadReads.userId, auth.userId)),
      });
      const watermark = read ? read.lastReadAt : new Date(0);
      const unreadRows = await this.db
        .select({ senderId: messages.senderId })
        .from(messages)
        .where(and(eq(messages.threadId, threadId), gt(messages.sentAt, watermark)));

      items.push(
        threadListItemSchema.parse({
          ...toThreadDto(thread),
          participantNames: parts
            .filter((p) => p.userId !== auth.userId)
            .map((p) => p.displayName),
          lastMessageAt: (last ? last.sentAt : thread.createdAt).toISOString(),
          unreadCount: unreadRows.filter((r) => r.senderId !== auth.userId).length,
        }),
      );
    }

    items.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    await this.audit.log(auth.tenantId, auth.userId, "view", "thread", "list");
    return items;
  }

  /** Messages newest-first with keyset pagination. */
  async listMessages(
    auth: RequestAuth,
    threadId: string,
    query: MessagesQuery,
  ): Promise<MessageWithSender[]> {
    await this.requireVisibleThread(auth, threadId);

    let cursorSentAt: Date | null = null;
    if (query.cursor) {
      const cursorMsg = await this.db.query.messages.findFirst({
        where: and(eq(messages.id, query.cursor), eq(messages.threadId, threadId)),
      });
      if (!cursorMsg) {
        throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
      }
      cursorSentAt = cursorMsg.sentAt;
    }

    const rows = await this.db
      .select({
        message: messages,
        senderName: users.displayName,
        senderRole: users.role,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(
        and(
          eq(messages.threadId, threadId),
          cursorSentAt && query.cursor
            ? or(
                lt(messages.sentAt, cursorSentAt),
                and(eq(messages.sentAt, cursorSentAt), lt(messages.id, query.cursor)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(messages.sentAt), desc(messages.id))
      .limit(query.limit);

    const result = rows.map((r) =>
      messageWithSenderSchema.parse({
        id: r.message.id,
        tenantId: r.message.tenantId,
        threadId: r.message.threadId,
        senderId: r.message.senderId,
        senderRole: r.senderRole,
        direction: r.message.direction,
        body: r.message.body,
        sentAt: r.message.sentAt.toISOString(),
        senderName: r.senderName,
      }),
    );
    await this.audit.log(auth.tenantId, auth.userId, "view", "thread", threadId);
    return result;
  }

  /** Send a message; notify the other participants (no-PHI payload). */
  async sendMessage(
    auth: RequestAuth,
    threadId: string,
    body: string,
  ): Promise<MessageWithSender> {
    const thread = await this.requireVisibleThread(auth, threadId);
    const direction = resolveDirection(auth.role);

    const [message] = await this.db
      .insert(messages)
      .values({
        tenantId: auth.tenantId,
        threadId: thread.id,
        senderId: auth.userId,
        direction,
        body,
      })
      .returning();
    if (!message) {
      throw new InternalServerErrorException({
        code: "message_send_failed",
        message: "Couldn't send the message. Try again.",
      });
    }

    const me = await this.db.query.users.findFirst({ where: eq(users.id, auth.userId) });
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, auth.tenantId),
    });
    const others = await this.db
      .select({ pushToken: users.pushToken })
      .from(threadParticipants)
      .innerJoin(users, eq(threadParticipants.userId, users.id))
      .where(
        and(eq(threadParticipants.threadId, threadId), ne(users.id, auth.userId)),
      );

    // Best-effort: the message is already saved; push must never fail the send.
    const parsedThread = threadSchema.parse(toThreadDto(thread));
    void this.push.notifyMany(
      others.flatMap((o) =>
        o.pushToken
          ? [
              {
                pushToken: o.pushToken,
                agencyName: tenant?.agencyName ?? "Your care team",
                direction,
                threadId: parsedThread.id,
              },
            ]
          : [],
      ),
    );

    return messageWithSenderSchema.parse({
      id: message.id,
      tenantId: message.tenantId,
      threadId: message.threadId,
      senderId: message.senderId,
      senderRole: me?.role ?? auth.role,
      direction: message.direction,
      body: message.body,
      sentAt: message.sentAt.toISOString(),
      senderName: me?.displayName ?? "Someone",
    });
  }

  /** Move my read watermark to now. */
  async markRead(auth: RequestAuth, threadId: string): Promise<{ ok: true }> {
    await this.requireVisibleThread(auth, threadId);
    await this.db
      .insert(threadReads)
      .values({ threadId, userId: auth.userId, lastReadAt: new Date() })
      .onConflictDoUpdate({
        target: [threadReads.threadId, threadReads.userId],
        set: { lastReadAt: new Date() },
      });
    return { ok: true };
  }

  /** Register my Expo push token (null clears it on sign-out). */
  async registerPushToken(auth: RequestAuth, token: string | null): Promise<{ ok: true }> {
    await this.db.update(users).set({ pushToken: token }).where(eq(users.id, auth.userId));
    return { ok: true };
  }
}

function toThreadDto(t: { id: string; tenantId: string; patientId: string; createdAt: Date }) {
  return {
    id: t.id,
    tenantId: t.tenantId,
    patientId: t.patientId,
    createdAt: t.createdAt.toISOString(),
  };
}
