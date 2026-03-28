import { lazy, Suspense } from "react";
import App from "@/App";
import SelectService from "@/pages";
import ProtectedLayout from "@/pages/layout";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { Loader2 } from "lucide-react";



// const NewSSH = lazy(() => import("@/pages/ssh-v/page"));
import NewSSH from '@/pages/ssh-v/page';
const SFTP = lazy(() => import("@/pages/sftp"));


const FileEditorMonacoPage = lazy(() => import("@/pages/sftp/components/FileEditorMonacoPage"));
const FileEditorModulePage = lazy(() => import("@/pages/sftp/components/FileEditorModulePage"));
const FileEditorApiPage = lazy(() => import("@/pages/sftp/components/FileEditorApiPage"));
const MediaPreviewPage = lazy(() => import("@/pages/sftp/components/MediaPreviewPage"));

const TerminalComponent = lazy(() => import("@/pages/shared-terminal"));
const CollabTerminalPage = lazy(() => import("@/modules/collab-terminal/page/CollabTerminalPage"));

/** Inline loading spinner shown while a lazy route chunk is being fetched */
function RouteLoader() {
    return (
        <div className="flex items-center justify-center h-screen w-full bg-[#1e1e2e]">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Loading…</span>
            </div>
        </div>
    );
}

/** Wrap a lazy element in Suspense with the route loader */
function withSuspense(element: React.ReactNode) {
    return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}


import { createBrowserRouter } from "react-router-dom";
import SocketContextProvider from "@/context/socket-context";
export const router = createBrowserRouter([
    {
        path: "/",
        index: true,
        element: <App />,
        errorElement: <RouteErrorBoundary />,

    },
    {
        path: "about",
        element: <div>About</div>,
    },

    {
        path: "/ssh/terminal/:sessionid",
        errorElement: <RouteErrorBoundary />,
        element: (
            <SocketContextProvider>
                {withSuspense(<TerminalComponent />)}
            </SocketContextProvider>
        ),
    },
    {
        path: "/ssh",
        element: <ProtectedLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
            {
                index: true,
                path: "",
                element: <SelectService />,
            },

            {
                path: "connect",
                element: <NewSSH />,
            },

            {
                path: "sftp",
                element: withSuspense(<SFTP />),
            },
            {
                path: "sftp/editor",
                element: withSuspense(<FileEditorMonacoPage />),
            },
            {
                path: "sftp/api-editor",
                element: withSuspense(<FileEditorApiPage />),
            },
            {
                path: "sftp/module-editor",
                element: withSuspense(<FileEditorModulePage />),
            },
            {
                path: "sftp/preview",
                element: withSuspense(<MediaPreviewPage />),
            },


        ]
    },
    {
        path: "/collab/terminal/:sessionId",
        errorElement: <RouteErrorBoundary />,
        element: withSuspense(<CollabTerminalPage />),
    },
    {
        path: "*",
        element: <div>404</div>,
    },
]);
