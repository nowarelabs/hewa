import { Global, Module } from "@nestjs/common";

import { loadEnv, type Env } from "../config/env.js";
import { ServiceTokenGuard } from "./service-token.guard.js";
import { SERVICE_TOKEN, WRITE_TOKEN } from "./tokens.js";
import { WriteTokenGuard } from "./write-token.guard.js";

/** Re-exported so one import finds both halves of a guard's contract. */
export { SERVICE_TOKEN, WRITE_TOKEN } from "./tokens.js";
export { SERVICE_TOKEN_HEADER } from "./service-token.guard.js";
export { WRITE_TOKEN_HEADER } from "./write-token.guard.js";

/**
 * The environment, loaded once and shared.
 *
 * `@Global` because the token is needed by the console module and health is the
 * only alternative to threading it through. The alternative — an `ENV` token and
 * a provider per module — is four lines repeated to avoid a global, and a
 * template should not model that.
 *
 * The guards are provided here rather than per controller so the tokens are read
 * at resolution from this `Env` and not from a second call to `loadEnv` somewhere
 * that could disagree with it.
 */
@Global()
@Module({
  providers: [
    {
      provide: SERVICE_TOKEN,
      // `string | undefined` and not `string`, and the annotation is the point
      // rather than a shrug: `loadEnv` allows an absent token so the process can
      // start, so the provider genuinely can hand the guard nothing. Declaring
      // `string` here would make tsc accept the narrower type and then compare
      // against `undefined` at runtime, which is the one comparison in this file
      // that must never happen.
      useFactory: (): string | undefined => loadEnv().serviceToken,
    },
    {
      // The same shape for the same reason, on a separate symbol. One factory
      // returning both tokens under one provider would be the coupling
      // `WRITE_TOKEN` exists to avoid: everything that can inject the read token
      // could then inject the write one.
      provide: WRITE_TOKEN,
      useFactory: (): string | undefined => loadEnv().writeToken,
    },
    // `useClass` rather than a factory: the guard's own constructor is annotated
    // with `@Inject(...)`, so providing the class is enough and the token arrives
    // the ordinary way. A factory here would have to name the parameter type, and
    // an unannotated `string` arrives as the class `String` — which Nest then
    // tries to resolve from the module graph.
    ServiceTokenGuard,
    WriteTokenGuard,
  ],
  exports: [SERVICE_TOKEN, WRITE_TOKEN, ServiceTokenGuard, WriteTokenGuard],
})
export class ServiceAuthModule {}

/** Re-exported so a consumer does not have to reach into `config/env` for the type. */
export type { Env };
