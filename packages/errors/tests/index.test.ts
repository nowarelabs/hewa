import { describe, expect, test } from "vite-plus/test";
import { ResponseCode } from "@hewa/response-codes";
import {
  AppError,
  ConflictError,
  ErrorCode,
  isAppError,
  NotFoundError,
  RateLimitedError,
  toAppError,
  ValidationError,
} from "../src/index.ts";

describe("AppError", () => {
  test("derives the response code and http status from the error code", () => {
    const error = new AppError(ErrorCode.Internal, "boom");
    expect(error.responseCode).toBe(ResponseCode.Internal);
    expect(error.httpStatus).toBe(500);
  });

  test("derives the category from the response code", () => {
    expect(new NotFoundError("Order").category).toBe("resource");
    expect(new ValidationError("bad").category).toBe("request");
    expect(new RateLimitedError().category).toBe("throttle");
  });

  test("keeps the subclass name", () => {
    expect(new NotFoundError("Order").name).toBe("NotFoundError");
  });

  test("serializes only what is safe to return", () => {
    const error = new NotFoundError("Order", 42);
    expect(error.toJSON("req-1")).toEqual({
      code: ErrorCode.ResourceNotFound,
      responseCode: ResponseCode.NotFound,
      message: 'Order "42" was not found',
      details: { resource: "Order", id: 42 },
      requestId: "req-1",
    });
  });

  test("summarizes the cause without leaking the stack", () => {
    const error = new AppError(ErrorCode.Internal, "boom", {
      cause: new Error("ECONNRESET"),
    });
    expect(error.toJSON().cause).toBe("ECONNRESET");
    expect(error.toJSON()).not.toHaveProperty("stack");
  });
});

describe("NotFoundError", () => {
  test("omits the id when there is not one", () => {
    expect(new NotFoundError("Order").message).toBe("Order was not found");
  });
});

describe("isAppError", () => {
  test("only accepts AppError instances", () => {
    expect(isAppError(new ValidationError("x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("x")).toBe(false);
  });
});

describe("toAppError", () => {
  test("passes AppErrors through untouched", () => {
    const original = new ConflictError("already exists");
    expect(toAppError(original)).toBe(original);
  });

  test("opaques unknown throwables", () => {
    const converted = toAppError(new Error("connection string leaked"));
    expect(converted.code).toBe(ErrorCode.Internal);
    expect(converted.message).toBe("An unexpected error occurred");
    expect(converted.httpStatus).toBe(500);
  });

  test("handles non-Error throwables", () => {
    expect(toAppError("nope").code).toBe(ErrorCode.Internal);
  });
});
