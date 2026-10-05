"use client";

import type { ReactElement } from "react";
import { AppShell } from "@hewa/app-shell";

import { config } from "./shell.config";

export default function App(): ReactElement {
  return <AppShell config={config} />;
}
