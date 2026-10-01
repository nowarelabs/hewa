import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("slas", "at_risk");

export const GET = handlers.GET;
