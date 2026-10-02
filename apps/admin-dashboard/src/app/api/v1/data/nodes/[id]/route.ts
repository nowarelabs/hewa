import { dataRecordHandlers } from "../../../_handlers";

export const dynamic = "force-dynamic";

const handlers = dataRecordHandlers("nodes");

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
