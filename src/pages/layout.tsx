import { Outlet, useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/layout/DashboardLayout';
import { useSockets } from '@/hooks/use-sockets';
import { useEffect } from 'react';
const ProtectedLayout = () => {
  const { isSSH_Connected } = useSockets();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isSSH_Connected) {
      navigate('/ssh');
    }
  }, [isSSH_Connected, navigate]);
  return (
    <Dashboard>     
      <Outlet />
    </Dashboard>
  );
};

export default ProtectedLayout;
