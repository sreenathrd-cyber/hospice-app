import { Body, Controller, Post } from "@nestjs/common";
import {
  loginSchema,
  requestCodeSchema,
  verifyCodeSchema,
  type Login,
  type RequestCode,
  type VerifyCode,
} from "@repo/types";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";

/**
 * Public by design — this IS the login. Every body is zod-validated;
 * nothing here reveals whether a phone number or email is registered.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("request-code")
  async requestCode(@Body(new ZodValidationPipe(requestCodeSchema)) body: RequestCode) {
    return this.auth.requestCode(body.phone);
  }

  @Post("verify-code")
  async verifyCode(@Body(new ZodValidationPipe(verifyCodeSchema)) body: VerifyCode) {
    return this.auth.verifyCode(body.phone, body.code);
  }

  @Post("login")
  async login(@Body(new ZodValidationPipe(loginSchema)) body: Login) {
    return this.auth.login(body.email, body.password);
  }
}
