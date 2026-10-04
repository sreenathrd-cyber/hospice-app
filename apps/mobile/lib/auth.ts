import {
  requestCodeResponseSchema,
  verifyCodeResponseSchema,
  type RequestCodeResponse,
  type Result,
  type VerifyCodeResponse,
} from "@repo/types";
import { apiPost } from "./api-client";

/** Auth boundary — thin wrappers over the API client, nothing more. */
export function requestCode(phone: string): Promise<Result<RequestCodeResponse>> {
  return apiPost("/auth/request-code", { phone }, (raw) =>
    requestCodeResponseSchema.parse(raw),
  );
}

export function verifyCode(phone: string, code: string): Promise<Result<VerifyCodeResponse>> {
  return apiPost("/auth/verify-code", { phone, code }, (raw) =>
    verifyCodeResponseSchema.parse(raw),
  );
}
