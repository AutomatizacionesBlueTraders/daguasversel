import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import logo from '@/assets/logo-daguas.jpg';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      navigate(user.debe_cambiar_password ? '/cambiar-password' : '/');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Error', description: 'Por favor complete todos los campos', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const result = await signIn(email.trim(), password);
    setIsLoading(false);

    if (!result.ok) {
      toast({
        title: 'Error de autenticación',
        description: result.errorMessage || 'Credenciales inválidas',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src={logo}
              alt="D'Aguas Logo"
              className="h-20 w-auto object-contain rounded-lg"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Sistema de Gestión de Información</CardTitle>
            <CardDescription className="text-muted-foreground">
              Ingrese sus credenciales para acceder
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-1 text-sm">
            <Link to="/recuperar-password" className="text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link to="/recuperar-password/codigo" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              ¿Te enviaron un código por correo? Úsalo aquí
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Contacte al administrador si no tiene credenciales de acceso
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
