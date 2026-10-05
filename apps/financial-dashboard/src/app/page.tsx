import { Suspense } from "react";

import App from "./App";

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen" />}>
      <App />
    </Suspense>
  );
}
