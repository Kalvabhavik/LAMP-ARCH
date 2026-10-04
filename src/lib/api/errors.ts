import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function okJson(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...body }, init);
}

export function errorJson(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/** Map any thrown error to the API error envelope. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return errorJson(err.status, err.code, err.message);
  if (err instanceof SyntaxError) return errorJson(400, "BAD_REQUEST", "Malformed request body.");
  return errorJson(500, "INTERNAL_ERROR", "Unexpected server error.");
}

/** Wrap a route handler so every error goes through the same envelope. */
export function withErrors<Ctx>(handler: (request: Request, ctx: Ctx) => Promise<NextResponse>) {
  return async (request: Request, ctx: Ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
