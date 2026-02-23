/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useEffect, useId, useState } from "react";
import { FilePane } from "./FilePane";
import { useSockets } from "@/hooks/use-sockets";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useToast } from "@/hooks/use-toast";
import { SFTP_FILES_LIST } from "./interface";

import SSHConnectionForm from "@/pages/ssh-v/components/ssh-connection-form";
import { useForm } from "react-hook-form";
import {
  DEFAULT_FORM_VALUES,
  formSchema,
  FormValues,
} from "@/pages/ssh-v/TerminalTab";
import { zodResolver } from "@hookform/resolvers/zod";
import { idb } from "@/lib/idb";

import { ShowProgressBar } from "./DownloadProgress";

import { HostsObject } from "@/pages";
import { Button } from "@/components/ui/button";
import { HostCard } from "@/pages/ssh-v/components/HostCard";

import { X } from "lucide-react";
export interface DownloadProgressType {
  name: string
  transferred: number
  totalSize: number
  percent: number
  speed: {
      speed: string;
      unit: string;
  }
  eta: number
  status: string
  remaining: Remaining
}

export interface Remaining {
  size: string
  unit: string
}

function OnlySFTPClient() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });
  const [hosts, setHosts] = useState<HostsObject[]>([])
  const [title, setTitle] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentDir, setCurrentDir] = useState("");
  const [homeDir, setHomeDir] = useState("");
  const [isError, setIsError] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgressType>>(
    {}
  );

  const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>(
    []
  );
  const { socket, isSftpConnected, isConnected } = useSockets();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const handleSetCurrentDir = (path?: string) => {
    setLoading(true);
    if (!path) {
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: homeDir });
      setLoading(false);
      return;
    }
    socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
    setLoading(false);
  };
  const handleSetLoading = (input: boolean) => {
    setLoading(input);
  };
  const handleSubmit = async (data: FormValues) => {
    if (data.saveCredentials) {
      const randomId = Math.random().toString(36).substring(2, 9);
      idb.has("hosts", hostId || "").then((exists) => {
        if (!exists) {
          idb.addNestedItem("hosts", randomId, {
            id: randomId,
            ...data,
          });
        } else {
          idb.updateItem("hosts", hostId!, data as any);
        }
      });
    }

    setLoading(true);
    socket?.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(data));
  };
  const downloadCancel = (filename: string) => {
    socket.emit(SocketEventConstants.CANCEL_DOWNLOADING, filename);
  };
  const handleClickOnHostCard = (index: number) => {
    let data = hosts[index]
    if (!data) {
      idb.getAllItems("hosts").then((data) => {
        if (data) {
          setHosts(data as any)
        }
      })
    }
    setHostId(data?.id)
    form.reset(data)
    handleSubmit(data as any)
    setTitle(data?.host)

  }
  useEffect(() => {


    socket.on(SocketEventConstants.SFTP_CURRENT_PATH, (cwd: string) => {
      setCurrentDir(cwd);
      setHomeDir(cwd);
      setLoading(false);
    });
    socket.on(SocketEventConstants.FILE_UPLOADED, (data: string) => {
      toast({
        title: "File Uploaded",
        description: "File uploaded successfully at " + data,
        variant: "default",
      });
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDir });
    });

    socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
      setRemoteFiles(JSON.parse(data.files));
      setCurrentDir(data.currentDir);
      setHomeDir(data.workingDir);
    });
    socket.on(SocketEventConstants.ERROR, (data: string) => {
      setIsError(true);
      toast({
        title: "SFTP Error",
        description: data,
        variant: "destructive",
      });
    });
    socket.on(SocketEventConstants.SUCCESS, (data: string) => {
      setIsError(true);
      toast({
        description: data,
        variant: "default",
      });
    });
    socket.on(SocketEventConstants.COMPRESSING, (data: string) => {
      console.log(data)
    });
     
    socket.on(
      SocketEventConstants.DOWNLOAD_PROGRESS,
      (data: DownloadProgressType) => {       
        setDownloadProgress((prev) => {
          if (data.percent >= 100) {
            const { [data.name]: _, ...rest } = prev;
            return rest;
          } else {
            return {
              ...prev,
              [data.name]: data,
            };
          }
        });
      }
    );

    return () => {
      socket.off(SocketEventConstants.SFTP_FILES_LIST);
      socket.off(SocketEventConstants.ERROR);
      socket.off(SocketEventConstants.SUCCESS);
      socket.off(SocketEventConstants.FILE_UPLOADED);
    };
  }, [socket, isSftpConnected, toast]);
  useEffect(() => {
    idb.getAllItems("hosts").then((data) => {
      if (data) {
        setHosts(data as any)
      }
    })

  }, [])
  return isConnected && isSftpConnected ? (
    <>
      <FilePane
        title={title || "Host"}
        files={remoteFiles}
        path={currentDir}
        hasError={isError}
        handleSetCurrentDir={handleSetCurrentDir}
        handleSetLoading={handleSetLoading}
        loading={loading}
      />
      {Object.keys(downloadProgress).length > 0 && (
        <div className="p-2 ">
          {Object.entries(downloadProgress).map(([key, file]) => (
            <ShowProgressBar key={key}
              download={file} onCancel={() => downloadCancel(file.name)}
              index={Object.keys(downloadProgress).indexOf(key)}
            />
          ))}
        </div>
      )}
    </>
  ) : (
    <div className="w-full">

      {hosts.length > 0 && !showForm ?
        <div className="p-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl font-semibold">Hosts</h2>
            <Button
              variant={"ghost"}
              onClick={() => setShowForm(true)}
              className="text-sm text-blue-400 hover:underline"
            >
              New Connection
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {hosts.length > 0 && hosts.map((host, index) => (
              <HostCard
                key={index}
                index={index}
                info={host}
                onClick={handleClickOnHostCard}
              />
            ))}
          </div>
        </div>
        :
        <SSHConnectionForm<typeof form>
          isLoading={loading}
          form={form}
          handleSubmit={handleSubmit}
        >
          <Button variant={"secondary"} className="mx-4" onClick={() => setShowForm(false)}>
            <X className="w-6 h-6 cursor-pointer" />
          </Button>
        </SSHConnectionForm>}
    </div>
  );
}
export default memo(OnlySFTPClient);
