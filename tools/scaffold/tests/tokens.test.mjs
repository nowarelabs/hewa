import { describe, expect, test } from "vite-plus/test";
import { tokensFor, substitute, substituteName } from "./lib/tokens.mjs";

const instance = {
  kind: "service",
  name: "billing-service",
  title: "Billing Service",
  description: "Invoicing, subscriptions, and payment state.",
  port: 4001,
};

describe("tokensFor", () => {
  test("derives an identifier-safe class name from a kebab-case name", () => {
    expect(tokensFor(instance).__CLASS__).toBe("BillingService");
  });

  test("derives an env prefix from a name with more than one separator", () => {
    expect(tokensFor({ ...instance, name: "customer-app" }).__ENV_PREFIX__).toBe("CUSTOMER_APP");
  });

  test("scopes the package name to the org", () => {
    expect(tokensFor(instance).__PACKAGE__).toBe("@hewa/billing-service");
  });

  test("keeps the port as a string so it can be interpolated anywhere", () => {
    expect(tokensFor(instance).__PORT__).toBe("4001");
  });
});

describe("substitute", () => {
  test("replaces every token in a body of text", () => {
    const tokens = tokensFor(instance);
    const result = substitute("__TITLE__ on __PORT__", tokens);

    expect(result).toBe("Billing Service on 4001");
  });

  test("resolves a token that runs straight into a suffix", () => {
    const tokens = tokensFor(instance);
    // The templates spell the variable as `__ENV_PREFIX___PORT`, so the regex
    // has to stop at the token's own closing underscores rather than swallow
    // them as part of a longer run.
    expect(substitute('source["__ENV_PREFIX___PORT"]', tokens)).toBe(
      'source["BILLING_SERVICE_PORT"]',
    );
  });

  test("leaves an unknown token alone rather than blanking it", () => {
    // A silent empty string would hide the mistake instead of surfacing it.
    expect(substitute("__NOT_A_TOKEN__", tokensFor(instance))).toBe("__NOT_A_TOKEN__");
  });
});

describe("substituteName", () => {
  test("substitutes tokens inside a path", () => {
    expect(substituteName("src/__CLASS__/index.ts", tokensFor(instance))).toBe(
      "src/BillingService/index.ts",
    );
  });
});
