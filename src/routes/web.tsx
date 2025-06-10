import App from "@/App";
import SelectService from "@/pages";
import ProtectedLayout from "@/pages/layout";
import SFTP from "@/pages/sftp";
import { TerminalComponent } from "@/pages/shared-terminal";
import { TerminalLayout } from "@/pages/ssh-v/components/terminal2";

import NewSSH from "@/pages/ssh-v/page";

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
                element: <SFTP />,
            },

        ]
    },
    {
        path: "*",
        element: <div>404</div>,
    },
]);