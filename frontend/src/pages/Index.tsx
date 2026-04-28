import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import PQR from './PQR';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to password change if required
  if (mustChangePassword) {
    return <Navigate to="/cambiar-password" replace />;
  }

  return (
    <AppLayout>
      <PQR />
    </AppLayout>
  );
}
