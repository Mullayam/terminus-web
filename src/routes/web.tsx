import { lazy } from "react";
import App from "@/App";
import SelectService from "@/pages";
import ProtectedLayout from "@/pages/layout";



// const NewSSH = lazy(() => import("@/pages/ssh-v/page"));
import NewSSH from '@/pages/ssh-v/page';
const SFTP = lazy(() => import("@/pages/sftp"));
 

const FileEditorMonacoPage = lazy(() => import("@/pages/sftp/components/FileEditorMonacoPage"));
const FileEditorModulePage = lazy(() => import("@/pages/sftp/components/FileEditorModulePage"));
const MediaPreviewPage = lazy(() => import("@/pages/sftp/components/MediaPreviewPage"));

const TerminalComponent = lazy(() => import("@/pages/shared-terminal"));



import { createBrowserRouter } from "react-router-dom";
import SocketContextProvider from "@/context/socket-context";
export const router = createBrowserRouter([
    {
        path: "/",
        index: true,
        element: <App />,

    },
    {
        path: "about",
        element: <div>About</div>,
    },
    {
        path: "/ssh/terminal/:sessionid",
        element: (
            <SocketContextProvider>
                <TerminalComponent />
            </SocketContextProvider>
        ),
    },
    {
        path: "/ssh",
        element: <ProtectedLayout />,
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
                element: <SFTP />,
            },


            {
                path: "sftp/edit",
                element: <FileEditorModulePage />,
            },

            {
                path: "sftp/editor",
                element: <FileEditorMonacoPage/>,
            },

            {
                path: "sftp/preview",
                element: <MediaPreviewPage />,
            },


        ]
    },
    {
        path: "*",
        element: <div>404</div>,
    },
]);