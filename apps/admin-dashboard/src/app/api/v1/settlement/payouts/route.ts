import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("settlement", "payouts");

export const GET = handlers.GET;
