/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import XTerminal from './Terminal';
import { zodResolver } from '@hookform/resolvers/zod';
import SSHConnectionForm from '@/pages/ssh/ssh-connection-form';
import { socket } from '@/lib/sockets';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { FullScreenLoader } from '@/components/loader';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSockets } from '@/hooks/use-sockets';
import { useNavigate } from 'react-router-dom';

const formSchema = z
  .object({
    host: z.string().min(1, 'Host is required'),
    username: z.string().min(1, 'Username is required'),
    authMethod: z.enum(['password', 'privateKey']),
    password: z.string().optional(),
    privateKeyText: z.string().optional(),
    privateKeyFile: z.instanceof(File).optional(),
  })
  .refine(
    (data) => {
      if (data.authMethod === 'password') {
        return !!data.password;
      } else {
        return !!data.privateKeyText || !!data.privateKeyFile;
      }
    },
    {
      message: 'Please provide either a password or a private key',
      path: ['authMethod'],
    }
  );

type FormValues = z.infer<typeof formSchema>;
const SSH = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const { isSSH_Connected, handleSSHConnection } = useSockets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [value, setValue] = useState({
    host: '',
    username: '',
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      host: '',
      username: '',
      authMethod: 'password',
      password: '',
      privateKeyText: '',
    },
  });

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    setError('');
    setValue(data);
    try {
      socket.emit(SocketEventConstants.SSH_CONNECT, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsLoading(false);
      toast({
        title: 'Socket Connection Error',
        description: error,
        variant: 'destructive',
      });
    }
  };
  useEffect(() => {
    socket.on(SocketEventConstants.SSH_READY, () => {
      setIsLoading(false);
      handleSSHConnection?.();
      form.reset();
    });
    socket.on(SocketEventConstants.SSH_DISCONNECTED, () => {
      handleSSHConnection?.();
    });

    return () => {
      socket.off(SocketEventConstants.SSH_READY);
      socket.off(SocketEventConstants.SSH_DISCONNECTED);
    };
  }, [form, handleSSHConnection]);

  useEffect(() => {
    if (!isSSH_Connected) {
      navigate('/ssh/connect');
    }
  }, [isSSH_Connected, navigate]);
  const handleReset = () => {
    form.reset();
  };
  return (
    <div>
      {isLoading && <FullScreenLoader />}
      {isSSH_Connected ? (
        <>
          <XTerminal />
          <div className="bg-gray-900 text-gray-200 p-1 text-xs text-right">
            Status:{' '}
            {isSSH_Connected ? (
              <div className="inline-flex items-center">
                <span className="size-2 inline-block bg-green-500 rounded-full me-2"></span>
                <span className="text-gray-200 dark:text-neutral-200">Connected</span>
              </div>
            ) : (
              <div className="inline-flex items-center">
                <span className="size-2 inline-block bg-red-500 rounded-full me-2"></span>
                <span className="text-gray-200 dark:text-neutral-200">Disconnected</span>
              </div>
            )}
          </div>
          <Alert>
            <AlertDescription>
              SSH connection established successfully!Do No Refresh the page , otherwise the connection will be lost
            </AlertDescription>
          </Alert>
          <div className="flex justify-between items-start flex-wrap mt-4 px-4">
            <div className="flex flex-col text-xs">
              <span>Public IPs: {value.host}</span>
              <span>Username: {value.username}</span>
            </div>
            <div className="mt-4 sm:mt-0">
              <button onClick={handleReset} className="bg-blue-500 text-white py-1 px-3 rounded hover:bg-blue-600">
                Reset
              </button>
            </div>
          </div>
        </>
      ) : (
        <SSHConnectionForm<typeof form> form={form} handleSubmit={handleSubmit} isLoading={isLoading} />
      )}
    </div>
  );
};

export default SSH;
