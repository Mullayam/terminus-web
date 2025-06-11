import React, { Suspense } from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import { router } from "./routes/web.tsx";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import FullScreenLoader from "./components/layout/FullScreenLoader.tsx";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Suspense fallback={<FullScreenLoader />}>
        <RouterProvider router={router} />
      </Suspense>
    </ThemeProvider>
  </React.StrictMode>
);
