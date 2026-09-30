import { viewHandlers } from "../_handlers";

/**
 * `/api/v1/economic` — the economy document — a single record, not a list.
 *
 * `force-dynamic` because this route talks to a service: a build-time prerender
 * would capture whatever central-api answered while the image was being built and
 * serve it as the console's contents until the next deploy.
 */
export const dynamic = "force-dynamic";

const handlers = viewHandlers("economic");

/** The read. Nothing else is exported, so one of the other verbs is a 405. */
export const GET = handlers.GET;
