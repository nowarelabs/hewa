import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("market", "prices");

export const GET = handlers.GET;
