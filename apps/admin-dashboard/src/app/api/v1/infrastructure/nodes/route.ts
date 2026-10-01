import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("infrastructure", "nodes");

export const GET = handlers.GET;
