import { z } from "zod";
import { visitIdSchema } from "./branded.js";

/** Telnyx Video Rooms — rooms are created server-side; clients only ever see short-lived tokens. */
export const videoRoomSchema = z.object({
  roomId: z.string().min(1),
  visitId: visitIdSchema,
  createdAt: z.string().datetime(),
});
export type VideoRoom = z.infer<typeof videoRoomSchema>;

export const videoClientTokenSchema = z.object({
  roomId: z.string().min(1),
  token: z.string().min(1),
  /** Tokens are short-lived. The client must re-request rather than cache. */
  expiresAt: z.string().datetime(),
});
export type VideoClientToken = z.infer<typeof videoClientTokenSchema>;

export const createVideoRoomRequestSchema = z.object({
  visitId: visitIdSchema,
});
export type CreateVideoRoomRequest = z.infer<typeof createVideoRoomRequestSchema>;
