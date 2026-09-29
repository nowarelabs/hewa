"use client";

import { useState } from "react";

import { AppLayout, MainPanel } from "./components";
import type { ViewMode } from "./components";

interface AppProps {
  theme?: "light" | "dark";
  onThemeChange?: (theme: "light" | "dark") => void;
}

export default function App({ theme = "dark", onThemeChange }: AppProps = {}) {
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(theme);
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>("flights");

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setCurrentTheme(newTheme);
    onThemeChange?.(newTheme);
  };

  return (
    <div className={currentTheme}>
      <AppLayout
        theme={currentTheme}
        onThemeChange={handleThemeChange}
        viewMode={currentViewMode}
        onSelectViewMode={setCurrentViewMode}
      >
        <MainPanel mode={currentViewMode} theme={currentTheme} />
      </AppLayout>
    </div>
  );
}
