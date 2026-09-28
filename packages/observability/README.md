# @hewa/observability

One logging shape, one request-context story, one metrics registry, shared by
every hewa app, service, and infrastructure process. No vendor SDK is wired in
yet — swapping the transport is a change to `createLogger`, not to call sites.

```ts
import { createLogger, getRequestId, MetricsRegistry } from "@hewa/observability";

const logger = createLogger({ service: "billing-service" });
logger.child({ requestId: getRequestId() }).info("invoice created", { invoiceId });
```

Request context rides on `AsyncLocalStorage`, so a log line emitted deep inside
a handler still carries its `requestId` without anything threading it through
by hand.
