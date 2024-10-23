import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./routes/web.tsx";
import SocketContextProvider from "./context/socket-context.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
  <ThemeProvider>
    <SocketContextProvider>
      <RouterProvider router={router} />
    </SocketContextProvider>
  </ThemeProvider>

  // </React.StrictMode>
);
