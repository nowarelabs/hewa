import { Module } from "@nestjs/common";
import { ConsoleController } from "./console.controller.js";

@Module({
  controllers: [ConsoleController],
})
export class ConsoleModule {}
