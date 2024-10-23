import App from "@/App";
import SelectService from "@/pages";
import ProtectedLayout from "@/pages/layout";
import SFTP from "@/pages/sftp";
import SSH from "@/pages/ssh";
import { Terminal2 } from "@/pages/ssh/terminal2";
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
        path: "/ssh/test",
        element: <Terminal2 />,
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
                element: <SSH />,
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