import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { api, getApiError } from '@/lib/api';
import PasswordStrengthMeter, { evaluatePassword } from '@/components/PasswordStrengthMeter';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import logo from '@/assets/logo-daguas.jpg';

export default function CambiarPassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading, mustChangePassword, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const userInputs = useMemo(() => [user?.email ?? '', user?.nombre ?? ''], [user?.email, user?.nombre]);
  const isForcedFirstLogin = mustChangePassword;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isForcedFirstLogin && !currentPassword) {
      toast({ title: 'Error', description: 'Ingresa tu contraseña actual', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
      return;
    }
    const evaluation = await evaluatePassword(newPassword, userInputs);
    if (!evaluation || evaluation.score < 3) {
      toast({
        title: 'Contraseña débil',
        description: evaluation?.warning || 'Elige una contraseña más segura',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/change-password', {
        password_actual: isForcedFirstLogin ? undefined : currentPassword,
        nueva_password: newPassword,
      });
      toast({ title: 'Éxito', description: 'Contraseña actualizada correctamente' });
      await refreshProfile();
      navigate('/');
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo cambiar la contraseña',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="D'Aguas Logo" className="h-16 w-auto object-contain rounded-lg" />
          </div>
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-primary">Cambiar contraseña</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isForcedFirstLogin
                ? 'Por seguridad, debe establecer una nueva contraseña para continuar'
                : 'Actualiza tu contraseña'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isForcedFirstLogin ? (
            <Alert className="border-warning/50 bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                <strong>Primer inicio de sesión:</strong> antes de continuar debe definir una contraseña personal.
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isForcedFirstLogin ? (
              <div className="space-y-2">
                <Label htmlFor="current-password">Contraseña actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus={isForcedFirstLogin}
              />
              <PasswordStrengthMeter password={newPassword} userInputs={userInputs} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repita la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar nueva contraseña'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
