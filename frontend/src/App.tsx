import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CambiarPassword from "./pages/CambiarPassword";
import RecuperarPassword from "./pages/RecuperarPassword";
import IngresarCodigo from "./pages/IngresarCodigo";
import RestablecerPassword from "./pages/RestablecerPassword";
import Usuarios from "./pages/Usuarios";
import Deudores from "./pages/Deudores";
import FacturacionUsuarios from "./pages/FacturacionUsuarios";
import SubirArchivo from "./pages/SubirArchivo";
import EstadisticasBot from "./pages/EstadisticasBot";
import MensajesBot from "./pages/MensajesBot";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/cambiar-password" element={<CambiarPassword />} />
              <Route path="/recuperar-password" element={<RecuperarPassword />} />
              <Route path="/recuperar-password/codigo" element={<IngresarCodigo />} />
              <Route path="/restablecer-password" element={<RestablecerPassword />} />
              <Route path="/" element={<Index />} />
              <Route
                path="/deudores"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Deudores />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/facturacion-usuarios"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <FacturacionUsuarios />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subir-archivo"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SubirArchivo />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/estadisticas-bot"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'usuario']}>
                    <AppLayout>
                      <EstadisticasBot />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mensajes-bot"
                element={
                  <ProtectedRoute requireAdmin>
                    <AppLayout>
                      <MensajesBot />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute requireAdmin>
                    <AppLayout>
                      <Usuarios />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
