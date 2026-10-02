import { dataRecordHandlers } from "../../../_handlers";

export const dynamic = "force-dynamic";

const handlers = dataRecordHandlers("settlements");

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
