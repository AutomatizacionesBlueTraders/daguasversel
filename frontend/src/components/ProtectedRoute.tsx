import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  /** Roles que pueden entrar. Si se indica, reemplaza a requireAdmin. */
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, requireAdmin = false, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isAdmin, role, mustChangePassword } = useAuth();

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

  // Force password change before allowing access
  if (mustChangePassword) {
    return <Navigate to="/cambiar-password" replace />;
  }

  const denied = allowedRoles
    ? !role || !allowedRoles.includes(role)
    : requireAdmin && !isAdmin;

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acceso Denegado</h1>
          <p className="text-muted-foreground">No tiene permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
