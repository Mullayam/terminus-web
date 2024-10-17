/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useState } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { FilePane } from "./components/FilePane"

// Mock data for file listings
const localFiles = [
  { name: "OneDriveTemp", dateModified: "8/28/2024, 3:04 PM", size: "--", kind: "folder" },
  { name: "PerfLogs", dateModified: "5/7/2022, 10:54 AM", size: "--", kind: "folder" },
  { name: "Program Files", dateModified: "10/4/2024, 9:28 PM", size: "--", kind: "folder" },
  { name: "Program Files (x86)", dateModified: "9/7/2024, 7:56 PM", size: "--", kind: "folder" },
  { name: "ProgramData", dateModified: "10/8/2024, 10:35 PM", size: "--", kind: "folder" },
  { name: "Python27", dateModified: "9/22/2024, 6:31 PM", size: "--", kind: "folder" },
  { name: "Users", dateModified: "8/28/2024, 2:54 PM", size: "--", kind: "folder" },
  { name: "Windows", dateModified: "10/9/2024, 11:55 AM", size: "--", kind: "folder" },
  { name: "$WINRE_BACKUP_PARTITION.MARKER", dateModified: "8/30/2024, 4:41 PM", size: "0 Bytes", kind: "MARKER" },
  { name: "appverifUI.dll", dateModified: "4/1/2024, 11:01 PM", size: "108.95 kB", kind: "dll" },
]

const remoteFiles = [
  { name: "..", dateModified: "", size: "--", kind: "folder" },
  { name: "test", dateModified: "8/25/2024, 9:37 PM", size: "--", kind: "folder" },
  { name: "saveit", dateModified: "7/22/2024, 11:03 AM", size: "--", kind: "folder" },
  { name: "redberyl-pwa", dateModified: "7/24/2024, 2:27 PM", size: "--", kind: "folder" },
  { name: "products", dateModified: "7/1/2024, 7:05 PM", size: "--", kind: "folder" },
  { name: "snap", dateModified: "10/1/2024, 5:30 AM", size: "--", kind: "folder" },
  { name: "haraka", dateModified: "8/19/2024, 11:04 PM", size: "--", kind: "folder" },
  { name: "smtp-server-with-mailbox", dateModified: "6/24/2024, 12:31 PM", size: "--", kind: "folder" },
  { name: "node-mail-pro", dateModified: "9/12/2024, 1:55 PM", size: "--", kind: "folder" },
  { name: "cozinco", dateModified: "5/2/2024, 2:09 PM", size: "--", kind: "folder" },
  { name: "sterm", dateModified: "10/14/2024, 9:28 PM", size: "48.95 MB", kind: "file" },
]



export default function SFTPClient() {
  const [transferProgress, setTransferProgress] = useState(0)

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel defaultSize={50}>
          <FilePane title="Local" files={localFiles} path="C: > /" />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <FilePane title="SaveIt" files={remoteFiles} path="home > ubuntu" />
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="p-2 bg-primary/5 text-sm">
        <div className="flex justify-between items-center">
          <span>appverifUI.dll</span>
          <span>58.6 kB/108.9 kB, 58.6 kB/s, about ~1 second remaining</span>
        </div>
        <div className="w-full bg-primary/20 rounded-full h-1.5 mt-1">
          <div
            className="bg-primary h-1.5 rounded-full"
            style={{ width: `${transferProgress}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}