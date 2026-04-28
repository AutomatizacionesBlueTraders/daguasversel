import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { api, getApiError } from '@/lib/api';
import { Loader2, MailCheck, ArrowRight } from 'lucide-react';
import logo from '@/assets/logo-daguas.jpg';

export default function RecuperarPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: value });
      setSent(true);
    } catch (err) {
      const payload = getApiError(err);
      if (payload?.code === 'EMAIL_NOT_FOUND') {
        toast({
          title: 'Email no registrado',
          description: 'Este correo no está registrado en el sistema. Verifica con el administrador.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: payload?.error || 'No se pudo enviar el correo',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="D'Aguas Logo" className="h-16 w-auto object-contain rounded-lg" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-primary">Recuperar contraseña</CardTitle>
            <CardDescription className="text-muted-foreground">
              Te enviaremos un correo con un enlace y un código de 6 dígitos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <>
              <Alert className="border-emerald-500/40 bg-emerald-500/10">
                <MailCheck className="h-4 w-4 text-emerald-600" />
                <AlertDescription>
                  Si el correo es válido, te llegará un mensaje en los próximos minutos.
                  Revisa también la carpeta de spam.
                </AlertDescription>
              </Alert>

              <Button
                className="w-full"
                onClick={() => navigate(`/recuperar-password/codigo?email=${encodeURIComponent(email.trim())}`)}
              >
                Ya recibí el código — ingresarlo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                ¿No te llegó? <button className="text-primary hover:underline" onClick={() => setSent(false)}>Reintentar</button>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar correo'
                )}
              </Button>
            </form>
          )}

          <p className="text-xs text-center text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Volver al login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
