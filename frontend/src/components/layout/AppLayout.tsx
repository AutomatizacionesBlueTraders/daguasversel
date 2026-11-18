import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Users, 
  LogOut, 
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Receipt,
  Upload,
  MessageCircle,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-daguas.jpg';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, role, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isTecnico = role === 'tecnico';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // For technicians: show "Gestión de Información"
  // For users: show "Gestión de Información PQRs"
  const pqrLabel = isTecnico ? 'Gestión de Información' : 'Gestión de Información PQRs';

  const navItems = [
    { path: '/', label: pqrLabel, icon: FileText, visible: true },
    { path: '/deudores', label: 'Búsqueda de Deudores', icon: Wallet, visible: !isTecnico },
    { path: '/facturacion-usuarios', label: 'Facturación Usuarios', icon: Receipt, visible: !isTecnico },
    { path: '/subir-archivo', label: 'Subir Archivo', icon: Upload, visible: !isTecnico },
    { path: '/estadisticas-bot', label: 'Estadisticas Bot', icon: BarChart3, visible: !isTecnico },
    { path: '/mensajes-bot', label: 'Mensajes Bot', icon: MessageCircle, visible: isAdmin },
    { path: '/usuarios', label: 'Usuarios', icon: Users, visible: isAdmin },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={cn(
            "p-4 border-b border-sidebar-border",
            sidebarCollapsed && "px-2"
          )}>
            <div className={cn(
              "flex items-center gap-3",
              sidebarCollapsed && "justify-center"
            )}>
              <img 
                src={logo} 
                alt="D'Aguas" 
                className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
              />
              {!sidebarCollapsed && (
                <div>
                  <h1 className="font-bold text-sidebar-foreground">D'Aguas</h1>
                  <p className="text-xs text-sidebar-foreground/70">SGI</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 p-4 space-y-1",
            sidebarCollapsed && "p-2"
          )}>
            {navItems
              .filter(item => item.visible)
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && item.label}
                  </Link>
                );
              })}
          </nav>

          {/* Collapse button (desktop only) */}
          <div className="hidden lg:block px-2 py-2 border-t border-sidebar-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              )}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Contraer menú
                </>
              )}
            </Button>
          </div>

          {/* User info & Logout */}
          <div className={cn(
            "p-4 border-t border-sidebar-border",
            sidebarCollapsed && "p-2"
          )}>
            {!sidebarCollapsed && (
              <div className="mb-3">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-sidebar-foreground/70 capitalize">
                  {role}
                </p>
              </div>
            )}
            <Button 
              variant="ghost" 
              className={cn(
                "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                sidebarCollapsed ? "justify-center px-0" : "justify-start"
              )}
              onClick={handleSignOut}
              title={sidebarCollapsed ? "Cerrar sesión" : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && <span className="ml-2">Cerrar sesión</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="D'Aguas" className="h-8 w-8 rounded object-cover" />
              <span className="font-bold text-primary">D'Aguas</span>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
