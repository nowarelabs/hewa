import { sectionHandlers } from "../../_handlers";

export const dynamic = "force-dynamic";

const handlers = sectionHandlers("slas", "commitments");

export const GET = handlers.GET;
