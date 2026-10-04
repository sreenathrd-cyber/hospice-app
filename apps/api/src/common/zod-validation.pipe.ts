import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import { z } from "zod";

/**
 * Boundary validation: every controller input is parsed against a zod v4
 * schema from @repo/types before handler logic runs. Invalid input fails
 * closed with a generic error — never with schema internals.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "validation_failed",
        message: "Request validation failed",
      });
    }
    return parsed.data;
  }
}
