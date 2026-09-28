/**
 * The workspace instances the templates are generated from.
 *
 * This file is the single place to add, remove, or rename a shell. Nothing
 * outside `tools/scaffold/templates` is edited to create a new one.
 */

/** @typedef {"app" | "service" | "infra"} Kind */

/**
 * @typedef {object} Instance
 * @property {Kind} kind
 * @property {string} name
 * @property {string} title
 * @property {string} description
 * @property {number} port
 * @property {string} [template] overrides the template the kind generates from
 * @property {Record<string, string>} [dependencies] libraries only this shell needs
 */

/** @type {ReadonlyArray<Instance>} */
export const INSTANCES = [
  // Front ends. All of these come from the same Next.js template.
  {
    kind: "app",
    name: "customer-app",
    title: "Customer App",
    description: "Customer-facing storefront and account surface.",
    port: 3001,
  },
  {
    kind: "app",
    name: "customer-billing-portal",
    title: "Customer Billing Portal",
    description: "Invoices, payment methods, and subscription management.",
    port: 3002,
  },
  {
    kind: "app",
    name: "customer-service-portal",
    title: "Customer Service Portal",
    description: "Support tickets and order enquiries for customers.",
    port: 3003,
  },
  {
    kind: "app",
    name: "developer-portal",
    title: "Developer Portal",
    description: "API keys, webhooks, and documentation for integrators.",
    port: 3004,
  },
  {
    kind: "app",
    name: "admin-dashboard",
    title: "Admin Dashboard",
    description: "Internal operations console for hewa staff.",
    port: 3005,
  },
  {
    kind: "app",
    name: "blog",
    title: "Hewa Blog",
    description: "The public engineering and product blog, built with Astro.",
    port: 3006,
    // Astro cannot share the Next.js template, but it is still one shell.
    template: "astro-app",
  },

  // NestJS services. All of these come from the same service template.
  {
    kind: "service",
    name: "central-api",
    title: "Central API",
    description: "The public entry point that fronts every other service.",
    port: 4000,
  },
  {
    kind: "service",
    name: "billing-service",
    title: "Billing Service",
    description: "Invoicing, subscriptions, and payment state.",
    port: 4001,
  },
  {
    kind: "service",
    name: "delivery-service",
    title: "Delivery Service",
    description: "Dispatch, courier assignment, and delivery tracking.",
    port: 4002,
  },
  {
    kind: "service",
    name: "matching-service",
    title: "Matching Service",
    description: "Matches orders to the best available courier.",
    port: 4003,
  },
  {
    kind: "service",
    name: "location-service",
    title: "Location Service",
    description: "Geocoding, routing, and live position history.",
    port: 4004,
  },

  // Infrastructure processes. All of these come from the same infra template.
  {
    kind: "infra",
    name: "event-gateway",
    title: "Event Gateway",
    description: "Kafka front door, speaking the protobuf schemas in @hewa/proto.",
    port: 4100,
    dependencies: {
      "@hewa/proto": "workspace:*",
      kafkajs: "catalog:",
    },
  },
  {
    kind: "infra",
    name: "document-vault",
    title: "Document Vault",
    description: "S3-backed storage for customer and operational documents.",
    port: 4101,
    dependencies: {
      "@aws-sdk/client-s3": "catalog:",
    },
  },
  {
    kind: "infra",
    name: "system-queue",
    title: "System Queue",
    description: "Redis-backed BullMQ workers for deferred and retrying work.",
    port: 4102,
    dependencies: {
      bullmq: "catalog:",
      ioredis: "catalog:",
    },
  },
];

/** @type {Record<Kind, string>} */
export const ROOTS = {
  app: "apps",
  service: "services",
  infra: "infra-services",
};

/**
 * The template a kind generates from. An instance may override it, which is how
 * the blog gets the Astro template while the other apps share the Next one.
 *
 * @type {Record<Kind, string>}
 */
export const TEMPLATES_BY_KIND = {
  app: "next-app",
  service: "service",
  infra: "infra",
};
