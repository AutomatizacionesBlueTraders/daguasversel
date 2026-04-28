import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { N8N_WEBHOOK_URL } from '@/lib/constants';

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

export default function SubirArchivo() {
  const { role } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const rolLabel = role === 'admin' ? 'administrador' : role === 'usuario' ? 'administrativo' : role ?? '';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Formato no válido',
        description: 'Solo se permiten archivos Excel (.xlsx, .xls)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo no debe superar los 10 MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setSent(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setSent(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!selectedFile) return;

    setSending(true);
    try {
      const base64 = await fileToBase64(selectedFile);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'subir_archivo',
          archivo: base64,
          nombre_archivo: selectedFile.name,
          tipo_mime: selectedFile.type,
          tipo: rolLabel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      setSent(true);
      toast({
        title: 'Archivo enviado',
        description: `"${selectedFile.name}" se envió correctamente.`,
      });
    } catch (err) {
      console.error('Error enviando archivo:', err);
      toast({
        title: 'Error al enviar',
        description: 'No se pudo enviar el archivo. Intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subir Archivo</h1>
        <p className="text-muted-foreground mt-1">
          Suba un archivo Excel para enviarlo al sistema de procesamiento.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Archivo Excel
          </CardTitle>
          <CardDescription>
            Formatos aceptados: .xlsx, .xls — Tamaño máximo: 10 MB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone / file selector */}
          {!selectedFile ? (
            <label
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">
                Haga clic para seleccionar un archivo Excel
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-lg border border-border">
              <FileSpreadsheet className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(selectedFile.size)}
                </p>
              </div>
              {sent ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  disabled={sending}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!selectedFile || sending || sent}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : sent ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Enviado correctamente
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar archivo
              </>
            )}
          </Button>

          {sent && (
            <Button variant="outline" onClick={removeFile} className="w-full">
              Subir otro archivo
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
