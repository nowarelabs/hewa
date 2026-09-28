import { httpStatusFor, ResponseCode } from "@hewa/response-codes";

/** Same health shape as every other hewa surface. */
export const prerender = false;

export function GET() {
  return new Response(
    JSON.stringify({
      service: "__PACKAGE__",
      code: ResponseCode.Ok,
      status: "ok",
    }),
    {
      status: httpStatusFor(ResponseCode.Ok),
      headers: { "content-type": "application/json" },
    },
  );
}
