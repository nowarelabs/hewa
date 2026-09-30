import { Module } from "@nestjs/common";

import { ServiceAuthModule } from "../service-auth.module.js";
import { ConflictsController } from "./conflicts.controller.js";

/**
 * The `conflicts` view: one controller, and the guard that protects it.
 *
 * `ServiceAuthModule` is imported here rather than only at the root so this
 * module is self-sufficient. A test that builds `ConflictsModule` on its own still
 * gets a resolvable token provider, and the `@UseGuards` on the controller
 * cannot fail at resolution for want of one. `ServiceAuthModule` is `@Global`, so
 * importing it from seven modules still constructs it once.
 *
 * There are no providers, and that is the right shape rather than a gap. The
 * records are constants, so the controller reads them directly and there is
 * nothing to inject; a provider here would be a layer whose only job was to be a
 * layer. What a view module *does* own is its own controller, so a view cannot
 * come to exist as a route with no module, or as a module whose controller was
 * added to the wrong one.
 */
@Module({
  imports: [ServiceAuthModule],
  controllers: [ConflictsController],
})
export class ConflictsModule {}
