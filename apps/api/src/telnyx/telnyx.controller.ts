import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
  createVideoRoomRequestSchema,
  smsSendRequestSchema,
  videoClientTokenSchema,
  videoRoomSchema,
  type CreateVideoRoomRequest,
  type SmsSendRequest,
} from "@repo/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TenantGuard } from "../tenant/tenant.guard.js";
import { TelnyxService } from "./telnyx.service.js";

/**
 * Messaging + video endpoints. Every route is tenant-guarded; every body is
 * zod-validated at the boundary. The API key never leaves this server.
 */
@UseGuards(TenantGuard)
@Controller()
export class TelnyxController {
  constructor(private readonly telnyx: TelnyxService) {}

  @Post("messages/sms")
  async sendSms(@Body(new ZodValidationPipe(smsSendRequestSchema)) body: SmsSendRequest) {
    return this.telnyx.sendSms(body);
  }

  @Post("video/rooms")
  async createRoom(
    @Body(new ZodValidationPipe(createVideoRoomRequestSchema)) body: CreateVideoRoomRequest,
  ) {
    const { roomId } = await this.telnyx.createVideoRoom();
    return videoRoomSchema.parse({
      roomId,
      visitId: body.visitId,
      createdAt: new Date().toISOString(),
    });
  }

  @Post("video/rooms/:roomId/token")
  async createToken(@Param("roomId") roomId: string) {
    const { token } = await this.telnyx.createClientToken(roomId);
    return videoClientTokenSchema.parse({
      roomId,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  }
}
