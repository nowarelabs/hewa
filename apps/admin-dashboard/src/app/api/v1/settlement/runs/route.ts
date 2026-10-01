import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("settlement", "runs");

export const GET = handlers.GET;
