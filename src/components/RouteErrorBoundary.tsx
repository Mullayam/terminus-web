import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Route-level error boundary used as `errorElement` in react-router.
 * Shows a friendly UI instead of the default "Unexpected Application Error!" page.
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this page.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} — ${error.statusText}`;
    message = error.data?.message ?? "The page you're looking for could not be loaded.";
  } else if (error instanceof Error) {
    // Dynamic import failures (chunk load / network errors)
    if (error.message.includes("dynamically imported module") || error.message.includes("Failed to fetch")) {
      title = "Failed to load page";
      message = "The page module could not be loaded. This usually means the server restarted or your network dropped. Try refreshing.";
    } else {
      message = error.message;
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1e2e] text-gray-200 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
