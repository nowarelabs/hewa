import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { isAppError, toAppError } from "@hewa/errors";
import { getRequestId, getLogger } from "@hewa/observability";
import type { Response } from "express";

/**
 * The single place a failure becomes an HTTP response.
 *
 * `AppError`s serialize themselves; anything else is opaqued by `toAppError`,
 * so an unexpected message never reaches a client. The request id travels back
 * in the body and the `x-request-id` header so a user-reported failure can be
 * traced to a log line.
 */
@Catch()
export class LocationServiceErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const requestId = getRequestId();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        code: String(status),
        message: exception.message,
        ...(requestId === undefined ? {} : { requestId }),
      });
      return;
    }

    const error = isAppError(exception) ? exception : toAppError(exception);
    getLogger().error("request failed", {
      requestId,
      error: exception,
      errorCode: error.code,
    });

    response.status(error.httpStatus).json(error.toJSON(requestId));
  }
}
