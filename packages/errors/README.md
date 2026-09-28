# @hewa/errors

Typed application errors. Every failure that crosses a service boundary is an
`AppError` carrying a stable `code`, the matching `@hewa/response-codes` code,
and the HTTP status. Anything else is treated as an internal fault and its
message is never returned to a client.

```ts
throw new NotFoundError("Order", orderId);
throw new ValidationError("Amount must be positive", { amount });
```

`toAppError` normalizes arbitrary throwables, so service boundaries only need
one catch site.
