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

const NEEDS_NEW_CODE = new Set(['TOKEN_EXPIRED', 'TOKEN_USED', 'TOO_MANY_ATTEMPTS']);

export default function IngresarCodigo() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const userInputs = useMemo(() => [email], [email]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/auth'), 2500);
      return () => clearTimeout(t);
    }
  }, [success, navigate]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== 6 || !pwd) {
      toast({ title: 'Error', description: 'Completa todos los campos', variant: 'destructive' });
      return;
    }
    if (pwd !== confirm) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden', variant: 'destructive' });
      return;
    }
    const evaluation = await evaluatePassword(pwd, [email]);
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
      await api.post('/auth/reset-password-with-code', {
        email: email.trim().toLowerCase(),
        code,
        nueva_password: pwd,
      });
      setSuccess(true);
    } catch (err) {
      const payload = getApiError(err);
      setErrorCode(payload?.code || 'INVALID_CODE');
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo restablecer la contraseña',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({ title: 'Falta el email', description: 'Escribe el correo primero', variant: 'destructive' });
      return;
    }
    setResending(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setErrorCode(null);
      setCode('');
      toast({ title: 'Listo', description: 'Te enviamos un nuevo código por correo' });
    } catch (err) {
      const payload = getApiError(err);
      toast({
        title: 'Error',
        description: payload?.error || 'No se pudo reenviar el código',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="D'Aguas Logo" className="h-16 w-auto object-contain rounded-lg" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-primary">Ingresa el código</CardTitle>
            <CardDescription className="text-muted-foreground">
              Escribe el código de 6 dígitos que recibiste por correo y define tu nueva contraseña.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorCode && NEEDS_NEW_CODE.has(errorCode) ? (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                Este código ya no sirve. Pide uno nuevo y vuelve a intentarlo.
                <Button
                  variant="link"
                  className="px-0 h-auto ml-1"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? 'Enviando…' : 'Enviar código nuevo'}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-[0.5em] py-3"
                maxLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd">Nueva contraseña</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
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

          <p className="text-xs text-center text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Volver al login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
