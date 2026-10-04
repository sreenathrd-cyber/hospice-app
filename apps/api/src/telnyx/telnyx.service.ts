import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { z } from "zod";
import type { SmsSendRequest } from "@repo/types";

/**
 * Telnyx integration — messaging (SMS) and Video Rooms.
 *
 * SECURITY: the Telnyx API key is read from process.env.TELNYX_API_KEY at call
 * time. It is NEVER logged, NEVER returned in a response, NEVER sent to a
 * client. Clients only ever receive short-lived video tokens and message IDs.
 * All calls are tenant-scoped by the guard on the controller.
 */
const TELNYX_BASE = "https://api.telnyx.com/v2";
const MESSAGES_PATH = "/messages";
const VIDEO_ROOMS_PATH = "/rooms";
/**
 * Per Telnyx's telnyx-meet reference implementation (pages/api/client_token.ts).
 * NOTE: this is NOT /video/rooms — the Rooms API lives at /v2/rooms, and the
 * client-token action is generate_join_client_token.
 */
const videoRoomTokenPath = (roomId: string): string =>
  `/rooms/${roomId}/actions/generate_join_client_token`;

const telnyxMessageResponse = z.object({ data: z.object({ id: z.string() }) });
const telnyxRoomResponse = z.object({ data: z.object({ id: z.string() }) });
const telnyxTokenResponse = z.object({ data: z.object({ token: z.string() }) });

export type TelnyxConfig = {
  apiKey: string;
  fromNumber: string;
};

function readConfig(): TelnyxConfig {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey || !fromNumber) {
    // Fail closed: no silent degradation to an unconfigured sender.
    throw new InternalServerErrorException({
      code: "telnyx_not_configured",
      message: "Messaging is not configured",
    });
  }
  return { apiKey, fromNumber };
}

@Injectable()
export class TelnyxService {
  private async post<T>(path: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const { apiKey } = readConfig();
    const res = await fetch(`${TELNYX_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Surface the failure loudly, but never include the key or raw body.
      throw new InternalServerErrorException({
        code: "telnyx_request_failed",
        message: `Telnyx request failed with status ${res.status}`,
      });
    }
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) {
      throw new InternalServerErrorException({
        code: "telnyx_bad_response",
        message: "Telnyx returned an unexpected response",
      });
    }
    return parsed.data;
  }

  /** Send an SMS via the Telnyx Messages API. Returns the Telnyx message ID. */
  async sendSms(request: SmsSendRequest): Promise<{ messageId: string }> {
    const { fromNumber } = readConfig();
    const result = await this.post(
      MESSAGES_PATH,
      { from: fromNumber, to: request.to, text: request.body },
      telnyxMessageResponse,
    );
    return { messageId: result.data.id };
  }

  /** Create a Telnyx Video Room for a visit. Returns the room ID. */
  async createVideoRoom(): Promise<{ roomId: string }> {
    const result = await this.post(VIDEO_ROOMS_PATH, {}, telnyxRoomResponse);
    return { roomId: result.data.id };
  }

  /**
   * Mint a short-lived client token for a room. The token — never the API key —
   * is what the mobile/web client uses to join.
   */
  async createClientToken(roomId: string): Promise<{ token: string }> {
    const result = await this.post(
      videoRoomTokenPath(roomId),
      { refresh_token_ttl_secs: 3600, token_ttl_secs: 60 },
      telnyxTokenResponse,
    );
    return { token: result.data.token };
  }
}
