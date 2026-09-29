"use client";

import type { ReactElement } from "react";
import { AppShell } from "@hewa/app-shell";

import { config } from "./shell.config";

/**
 * The app is a configuration object and this component, which is the point of
 * the refactor. It used to hold the current theme in state, hold the current
 * view in state, hand both to a layout component that kept them in a third and
 * fourth piece of state, and render a `MainPanel` that switched over the view to
 * find a panel. The shell owns all of that now, and the URL keeps the view, the
 * rail selection and the panel collapse state so a link reopens the console where
 * you left it.
 */
export default function App(): ReactElement {
  return <AppShell config={config} />;
}
