/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react"
import { FilePane } from "./components/FilePane"
import { useSockets } from "@/hooks/use-sockets"
import { SocketEventConstants } from "@/lib/sockets/event-constants"
import { useToast } from '@/hooks/use-toast';
import { SFTP_FILES_LIST } from "./components/interface";

const mockFiles = [
  {
    "type": "d",
    "name": "air-rest-api",
    "size": 4096,
    "modifyTime": 1729799923000,
    "accessTime": 1729959469000,
    "rights": {
      "user": "rwx",
      "group": "rx",
      "other": "rx"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "drwxr-xr-x    7 mullayam mullayam     4096 Oct 25 01:28 air-rest-api"
  },
  {
    "type": "d",
    "name": ".cache",
    "size": 4096,
    "modifyTime": 1728772262000,
    "accessTime": 1728772264000,
    "rights": {
      "user": "rwx",
      "group": "",
      "other": ""
    },
    "owner": 1000,
    "group": 1001,
    "longname": "drwx------    8 mullayam mullayam     4096 Oct 13 04:01 .cache"
  },
  {
    "type": "-",
    "name": ".sudo_as_admin_successful",
    "size": 0,
    "modifyTime": 1724842082000,
    "accessTime": 1725268982000,
    "rights": {
      "user": "rw",
      "group": "r",
      "other": "r"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "-rw-r--r--    1 mullayam mullayam        0 Aug 28 16:18 .sudo_as_admin_successful"
  },
  {
    "type": "-",
    "name": ".gitconfig",
    "size": 82,
    "modifyTime": 1729710728000,
    "accessTime": 1729959470000,
    "rights": {
      "user": "rw",
      "group": "r",
      "other": "r"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "-rw-r--r--    1 mullayam mullayam       82 Oct 24 00:42 .gitconfig"
  },
  {
    "type": "d",
    "name": ".mvm",
    "size": 4096,
    "modifyTime": 1728404070000,
    "accessTime": 1728404008000,
    "rights": {
      "user": "rwx",
      "group": "rx",
      "other": "rx"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "drwxr-xr-x    3 mullayam mullayam     4096 Oct  8 21:44 .mvm"
  },
  {
    "type": "d",
    "name": ".bun",
    "size": 4096,
    "modifyTime": 1726122010000,
    "accessTime": 1726122010000,
    "rights": {
      "user": "rwx",
      "group": "rx",
      "other": "rx"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "drwxr-xr-x    3 mullayam mullayam     4096 Sep 12 11:50 .bun"
  },
  {
    "type": "d",
    "name": "sss",
    "size": 4096,
    "modifyTime": 1728925702000,
    "accessTime": 1729793630000,
    "rights": {
      "user": "rwx",
      "group": "rx",
      "other": "rx"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "drwxr-xr-x    8 mullayam mullayam     4096 Oct 14 22:38 sss"
  },
  {
    "type": "d",
    "name": "node-mail-pro",
    "size": 4096,
    "modifyTime": 1726128144000,
    "accessTime": 1727036460000,
    "rights": {
      "user": "rwx",
      "group": "rx",
      "other": "rx"
    },
    "owner": 1000,
    "group": 1001,
    "longname": "drwxr-xr-x    6 mullayam mullayam     4096 Sep 12 13:32 node-mail-pro"
  }
]

export default function SFTPClient() {
  const [transferProgress, setTransferProgress] = useState(0)
  const [currentDir, setCurrentDir] = useState("")
  const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>([])
  const { socket, isSSH_Connected } = useSockets()
  const { toast } = useToast()

 
  useEffect(() => {
    if (isSSH_Connected) {
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: './' })
      socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
        setRemoteFiles(data.files)
        setCurrentDir(data.currentDir)
      })
    }

    return () => {
      socket.off(SocketEventConstants.SFTP_FILES_LIST)
      socket.on(SocketEventConstants.ERROR, (data: string) => {
        toast({
          title: 'SFTP Error',
          description: data,
          variant: 'destructive',
        })
      });
    }
  }, [socket, isSSH_Connected])
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <FilePane
        title="WSL"
        files={remoteFiles}
        path={currentDir}        
      />
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