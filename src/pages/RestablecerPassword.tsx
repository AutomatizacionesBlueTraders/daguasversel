import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { api, getApiError } from '@/lib/api';
import PasswordStrengthMeter, { evaluatePassword } from '@/components/PasswordStrengthMeter';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import logo from '@/assets/logo-daguas.jpg';

const NEEDS_NEW_TOKEN = new Set(['TOKEN_EXPIRED', 'TOKEN_USED', 'INVALID_TOKEN']);

export default function RestablecerPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const userInputs = useMemo<string[]>(() => [], []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/auth'), 2500);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ title: 'Error', description: 'Enlace inválido', variant: 'destructive' });
      return;
    }
    if (!pwd || pwd !== confirm) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
      return;
    }
    const evaluation = await evaluatePassword(pwd);
    if (!evaluation || evaluation.score < 3) {
      toast({
        title: 'Contraseña débil',
        description: evaluation?.warning || 'Elige una contraseña más segura',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setErrorCode(null);
    try {
      await api.post('/auth/reset-password', { token, nueva_password: pwd });
      setSuccess(true);
    } catch (err) {
      const payload = getApiError(err);
      setErrorCode(payload?.code || 'INVALID_TOKEN');
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo restablecer',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md shadow-xl border-primary/10">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold">Contraseña actualizada</h2>
            <p className="text-sm text-muted-foreground">Te redirigimos al login…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || (errorCode && NEEDS_NEW_TOKEN.has(errorCode))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md shadow-xl border-primary/10">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl font-bold text-primary">Enlace no válido</CardTitle>
            <CardDescription>Este enlace expiró o ya fue usado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Solicita uno nuevo o usa el código de 6 dígitos del correo.
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={() => navigate('/recuperar-password')}>
              Solicitar nuevo enlace
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/recuperar-password/codigo')}>
              Tengo el código de 6 dígitos
            </Button>
            <p className="text-xs text-center">
              <Link to="/auth" className="text-primary hover:underline">Volver al login</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="D'Aguas Logo" className="h-16 w-auto object-contain rounded-lg" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-primary">Restablecer contraseña</CardTitle>
            <CardDescription className="text-muted-foreground">
              Define una nueva contraseña para tu cuenta.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pwd">Nueva contraseña</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                autoFocus
              />
              <PasswordStrengthMeter password={pwd} userInputs={userInputs} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar contraseña'
              )}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-4">
            <Link to="/auth" className="text-primary hover:underline">Volver al login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
