import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { CONSOLE_VIEWS, consolePath } from "@hewa/console-types";

import { viewHandlers } from "../src/app/api/v1/_handlers";

/**
 * The route handlers, and what they are for.
 *
 * The central claim of this arrangement is that the browser cannot reach
 * central-api: every request goes through a route handler here, and the service
 * token is read from the environment on the server and never crosses into the
 * client. That is a claim about the *shape* of the code, so most of these tests
 * assert the shape — which verbs exist, where the path can go, whether the token
 * header leaves — rather than the forwarding itself.
 *
 * A second claim is shared with `query.test.ts`: the browser sends a *relative*
 * path. This file cannot see the browser's URL, so the two together are what
 * prove the full route — relative out, relative back, with the base URL supplied
 * only by the server.
 */

/** The token, and the URL the service is pretended to live at. */
const TOKEN = "a-service-token";
const BASE = "http://central.test";

/** What the pretended service was asked for, filled in by the fetch stub. */
interface Seen {
  url: string;
  method: string;
  token: string | null;
}

let seen: Seen[] = [];

/** A `fetch` that records the request and answers an envelope. */
function stubService(body: unknown = { code: "0", data: [] }, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      seen.push({
        url: String(url),
        method: init.method ?? "GET",
        token: headers.get("x-hewa-service-token"),
      });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

/** A `Request` to hand a `GET` handler, which ignores it. */
function get(): Request {
  return new Request("http://app.test/api/v1/alerts");
}

beforeEach(() => {
  seen = [];
  process.env["CENTRAL_API_URL"] = BASE;
  process.env["CENTRAL_API_SERVICE_TOKEN"] = TOKEN;
  stubService();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["CENTRAL_API_URL"];
  delete process.env["CENTRAL_API_SERVICE_TOKEN"];
});

describe("the token", () => {
  test("it is attached to the service's request and is not the browser's to know", async () => {
    await viewHandlers("alerts").GET(get());

    expect(seen[0]?.token).toBe(TOKEN);
  });

  test("a missing token is a 500 that names the variable, not a request to the service", async () => {
    delete process.env["CENTRAL_API_SERVICE_TOKEN"];

    const response = await viewHandlers("alerts").GET(get());
    const body = (await response.json()) as { code: string; message: string };

    // A default would be a known token in a repository. Failing here says which
    // variable is missing, to whoever deployed this.
    expect(response.status).toBe(500);
    expect(body.message).toContain("CENTRAL_API_SERVICE_TOKEN");
    expect(seen).toHaveLength(0);
  });

  test("an empty token is treated as no token", async () => {
    // `process.env.X = ""` is what a deploy gets from an unset variable in a
    // compose file, and it is a value, so a check for `undefined` alone would
    // attach an empty secret and be refused by the service's guard on every call.
    process.env["CENTRAL_API_SERVICE_TOKEN"] = "";

    const response = await viewHandlers("alerts").GET(get());

    expect(response.status).toBe(500);
    expect(seen).toHaveLength(0);
  });
});

describe("which paths exist", () => {
  test("every view in the contract is routable, and answers", async () => {
    // Checked against `CONSOLE_VIEWS` rather than a list written out here, so a
    // view added to the contract and forgotten here fails rather than shipping
    // with a panel that 404s.
    for (const view of CONSOLE_VIEWS) {
      const response = await viewHandlers(view).GET(get());

      expect(response.status, view).toBe(200);
      expect(seen.at(-1)?.url, view).toBe(`${BASE}${consolePath(view)}`);
    }
  });

  test("a handler carries no verb but GET", async () => {
    // The read surface is the whole surface. A `POST` that is not exported gets
    // Next's own 405 and central-api is never asked — and the object a route file
    // exports is visible here, which is a cheaper place to check than a request.
    const handlers = viewHandlers("alerts");

    expect(Object.keys(handlers)).toEqual(["GET"]);
  });

  test("the upstream path is the one the browser used, and only the base differs", async () => {
    await viewHandlers("infrastructure").GET(get());

    // Same path, different base. That equality is the whole arrangement: the
    // service registers `consolePath`, the browser sends `consolePath`, and this
    // file builds `CENTRAL_API_URL + consolePath`. There is no second spelling.
    expect(seen[0]?.url).toBe(`${BASE}/api/v1/infrastructure`);
    expect(seen[0]?.url.endsWith(consolePath("infrastructure"))).toBe(true);
  });

  test("the path comes from the contract, not from a string written out here", async () => {
    // `consolePath` is the one place the path exists, and the service's e2e test
    // asserts its routes against the same function — so a rename moves both sides
    // or fails one of them, instead of leaving a route that answers nothing.
    expect(consolePath("slas")).toBe("/api/v1/slas");
  });

  test("a trailing slash on the base URL does not double up", async () => {
    process.env["CENTRAL_API_URL"] = "http://central.test/";

    await viewHandlers("settlement").GET(get());

    expect(seen[0]?.url).toBe(`${BASE}/api/v1/settlement`);
  });

  test("the upstream request is never a cached one", async () => {
    // A record changed in central-api would otherwise be served from a cache that
    // `fetch` on the server is free to keep, and the operator would watch their
    // own change not appear.
    await viewHandlers("market").GET(get());

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.cache).toBe("no-store");
  });
});

describe("what comes back", () => {
  test("the service's status and envelope pass through unchanged", async () => {
    // One envelope in the system: a panel reads the same shape whether it reached
    // this app or the service. A 401 from the guard is the case that matters —
    // it means the token was wrong, and flattening it to a 200 with an empty
    // envelope would show the operator an empty view instead.
    stubService({ code: "3000", message: "a valid service token is required" }, 401);

    const response = await viewHandlers("alerts").GET(get());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: "3000",
      message: "a valid service token is required",
    });
  });

  test("the view's groups arrive, so the filter bar is not derived from the rows", async () => {
    stubService({ code: "0", data: [], meta: { groups: ["armed", "election"] } });

    const response = await viewHandlers("infrastructure").GET(get());

    expect(await response.json()).toEqual({
      code: "0",
      data: [],
      meta: { groups: ["armed", "election"] },
    });
  });

  test("the service's headers are not relayed", async () => {
    // A header the service sets is not this app's to publish, and a future one
    // could carry an internal hostname. Only the body is passed on.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: "0", data: [] }), {
            status: 200,
            headers: { "content-type": "application/json", "x-internal-upstream": "node-7" },
          }),
      ),
    );

    const response = await viewHandlers("alerts").GET(get());

    expect(response.headers.get("x-internal-upstream")).toBeNull();
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  test("a service that cannot be reached is a 502, not a stack trace", async () => {
    // An operator looking at a panel should be told central-api is unreachable.
    // They should not be shown the URL that failed to resolve.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND central.test");
      }),
    );

    const response = await viewHandlers("alerts").GET(get());
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(502);
    expect(body.code).toBe("5004");
    expect(body.message).not.toContain("central.test");
  });

  test("something that is not the service is a 502, and its text is not relayed", async () => {
    // A proxy's HTML error page, or a load balancer's plain text. Relaying it
    // would put that text in a panel as though it were data.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 200 })),
    );

    const response = await viewHandlers("alerts").GET(get());
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(502);
    expect(body.message).toContain("not JSON");
    expect(body.message).not.toContain("<html>");
  });
});
