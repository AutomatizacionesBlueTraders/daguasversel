import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Loader2 } from 'lucide-react';

interface PQRStatusChangerProps {
  pqrId: number;
  currentEstado?: string;
  onCambiarEstado: (id: number, nuevoEstado: string) => Promise<boolean>;
  updating: number | null;
  variant?: 'button' | 'icon';
}

export default function PQRStatusChanger({ 
  pqrId, 
  currentEstado = 'Actual',
  onCambiarEstado, 
  updating,
  variant = 'button'
}: PQRStatusChangerProps) {
  const [customEstado, setCustomEstado] = useState('');
  const [open, setOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; nuevoEstado: string }>({ open: false, nuevoEstado: '' });

  const handleRequestChange = (nuevoEstado: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(false);
    setConfirmDialog({ open: true, nuevoEstado });
  };

  const handleConfirmChange = async () => {
    await onCambiarEstado(pqrId, confirmDialog.nuevoEstado);
    setConfirmDialog({ open: false, nuevoEstado: '' });
    setCustomEstado('');
  };

  const handleCustomSubmit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (customEstado.trim()) {
      handleRequestChange(customEstado.trim(), e);
    }
  };

  const isUpdating = updating === pqrId;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          {variant === 'button' ? (
            <Button 
              variant="outline" 
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MoreHorizontal className="h-4 w-4 mr-2" />
              )}
              Cambiar Estado
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background z-50">
          <DropdownMenuItem onClick={(e) => handleRequestChange('EN_PROCESO', e)}>
            En Proceso
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => handleRequestChange('SOLUCIONADO', e)}>
            Solucionado
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="p-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-muted-foreground mb-2">Estado personalizado:</p>
            <div className="flex gap-2">
              <Input
                placeholder="Escribir estado..."
                value={customEstado}
                onChange={(e) => setCustomEstado(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    handleCustomSubmit(e as unknown as React.MouseEvent);
                  }
                }}
                className="h-8"
              />
              <Button 
                size="sm" 
                className="h-8"
                onClick={handleCustomSubmit}
                disabled={!customEstado.trim()}
              >
                Enviar
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, nuevoEstado: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de estado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea cambiar el estado de la PQR #{pqrId} de <strong>"{currentEstado}"</strong> a <strong>"{confirmDialog.nuevoEstado}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
