import { lazy } from "react";
import App from "@/App";
import SelectService from "@/pages";
import ProtectedLayout from "@/pages/layout";



// const NewSSH = lazy(() => import("@/pages/ssh-v/page"));
import NewSSH from '@/pages/ssh-v/page';
const SFTP = lazy(() => import("@/pages/sftp"));
const TerminalComponent = lazy(() => import("@/pages/shared-terminal"));
const TerminalLayout = lazy(() => import("@/pages/ssh-v/components/terminal2"));



import { createBrowserRouter } from "react-router-dom";
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
        element: <TerminalLayout>
            <TerminalComponent />
        </TerminalLayout>,
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
                element: <SFTP only_sftp={true} />,
            },
            {
                path: "only-sftp",
                element: <SFTP only_sftp={false} />,
            },
        ]
    },
    {
        path: "*",
        element: <div>404</div>,
    },
]);