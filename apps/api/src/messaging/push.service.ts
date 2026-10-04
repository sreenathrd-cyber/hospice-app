import { Injectable, Logger } from "@nestjs/common";
import {
  buildAlertPushNotification,
  buildPushNotification,
  type MessageDirection,
  type PushNotification,
  type ThreadId,
} from "@repo/types";
import { isValidPushToken } from "./messaging.logic.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushRecipient = {
  pushToken: string;
  agencyName: string;
  direction: MessageDirection;
  threadId: ThreadId;
};

export type AlertPushRecipient = {
  pushToken: string;
  agencyName: string;
};

/**
 * Sends push notifications via Expo. Best-effort by design: the underlying
 * record (message, alert) is already persisted before this runs, so a push
 * failure must never fail the request — it is logged loudly instead.
 * Payloads are built ONLY via the build*PushNotification helpers: generic
 * body, zero PHI (see @repo/types messaging).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async notifyMany(recipients: PushRecipient[]): Promise<void> {
    await this.send(
      recipients
        .filter((r) => isValidPushToken(r.pushToken))
        .map((r) => ({
          pushToken: r.pushToken,
          notification: buildPushNotification(r.agencyName, r.direction, r.threadId),
        })),
    );
  }

  async notifyAlert(recipients: AlertPushRecipient[]): Promise<void> {
    await this.send(
      recipients
        .filter((r) => isValidPushToken(r.pushToken))
        .map((r) => ({
          pushToken: r.pushToken,
          notification: buildAlertPushNotification(r.agencyName),
        })),
    );
  }

  private async send(
    items: { pushToken: string; notification: PushNotification }[],
  ): Promise<void> {
    if (items.length === 0) return;
    const messages = items.map((i) => ({
      to: i.pushToken,
      title: i.notification.title,
      body: i.notification.body,
      data: i.notification.data,
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.error(`Expo push failed: HTTP ${res.status} — notifications not delivered`);
      }
    } catch (error) {
      this.logger.error(
        `Expo push request failed — notifications not delivered: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }
}
