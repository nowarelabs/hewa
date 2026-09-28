import { describe, expect, test } from "vite-plus/test";
import {
  categoryFor,
  httpStatusFor,
  isResponseCode,
  RESPONSE_CODE_CATEGORIES,
  ResponseCode,
} from "../src/index.ts";

describe("isResponseCode", () => {
  test("accepts known codes", () => {
    expect(isResponseCode(ResponseCode.NotFound)).toBe(true);
    expect(isResponseCode("3000")).toBe(true);
  });

  test("rejects anything else", () => {
    expect(isResponseCode("9999")).toBe(false);
    expect(isResponseCode(3000)).toBe(false);
    expect(isResponseCode(undefined)).toBe(false);
  });
});

describe("httpStatusFor", () => {
  test("maps client errors to 4xx", () => {
    expect(httpStatusFor(ResponseCode.InvalidRequest)).toBe(400);
    expect(httpStatusFor(ResponseCode.Unauthenticated)).toBe(401);
    expect(httpStatusFor(ResponseCode.NotFound)).toBe(404);
    expect(httpStatusFor(ResponseCode.Conflict)).toBe(409);
  });

  test("maps system errors to 5xx", () => {
    expect(httpStatusFor(ResponseCode.Internal)).toBe(500);
    expect(httpStatusFor(ResponseCode.Unavailable)).toBe(503);
  });
});

describe("categoryFor", () => {
  test("groups every code into a known category", () => {
    for (const code of Object.values(ResponseCode)) {
      expect(RESPONSE_CODE_CATEGORIES).toContain(categoryFor(code));
    }
  });

  test("treats single-digit success codes as ok", () => {
    expect(categoryFor(ResponseCode.Ok)).toBe("ok");
    expect(categoryFor(ResponseCode.Created)).toBe("ok");
  });

  test("splits the numeric ranges", () => {
    expect(categoryFor(ResponseCode.ValidationFailed)).toBe("request");
    expect(categoryFor(ResponseCode.TokenExpired)).toBe("auth");
    expect(categoryFor(ResponseCode.AlreadyExists)).toBe("resource");
    expect(categoryFor(ResponseCode.RateLimited)).toBe("throttle");
    expect(categoryFor(ResponseCode.Timeout)).toBe("system");
  });
});
