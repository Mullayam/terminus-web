import { Outlet } from 'react-router-dom';
import { Dashboard } from '@/components/layout/DashboardLayout';

const ProtectedLayout = () => {

  return (
    <Dashboard>
      <Outlet />
    </Dashboard>
  );
};

export default ProtectedLayout;
