import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("settlement", "movements");

export const GET = handlers.GET;
