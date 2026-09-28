import { httpStatusFor, ResponseCode } from "@hewa/response-codes";

/**
 * Liveness and readiness in one stub. It reports the shared response code so
 * every service and app in the workspace answers health checks the same way.
 */
export function GET() {
  return Response.json(
    {
      service: "@hewa/billing-reconciliation-ui",
      code: ResponseCode.Ok,
      status: "ok",
    },
    { status: httpStatusFor(ResponseCode.Ok) },
  );
}
