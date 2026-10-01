import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("alerts", "outages");

export const GET = handlers.GET;
