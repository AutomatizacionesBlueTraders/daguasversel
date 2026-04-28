import { PQRItem, IMAGE_FIELDS } from '@/types/pqr';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { MapPin, Phone, User, FileText, Image, MoreVertical, Loader2, Clock, Activity, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PQRDashboardProps {
  data: PQRItem[];
  onSelectPQR: (pqr: PQRItem) => void;
  onCambiarEstado: (id: number, nuevoEstado: string) => Promise<boolean>;
  updating: number | null;
}

interface PendingChange {
  id: number;
  nuevoEstado: string;
  currentEstado: string;
}

// Separate component for the dropdown so each card has its own isolated state
function PQRCardDropdown({ 
  pqrId, 
  currentEstado, 
  isUpdating, 
  onRequestChange 
}: { 
  pqrId: number; 
  currentEstado: string; 
  isUpdating: boolean;
  onRequestChange: (id: number, nuevoEstado: string, currentEstado: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customEstado, setCustomEstado] = useState('');

  const handleSelect = (nuevoEstado: string) => {
    setIsOpen(false);
    onRequestChange(pqrId, nuevoEstado, currentEstado);
  };

  const handleCustomSubmit = () => {
    const estado = customEstado.trim();
    if (estado) {
      setIsOpen(false);
      setCustomEstado('');
      onRequestChange(pqrId, estado, currentEstado);
    }
  };

  return (
    <div 
      onClick={(e) => e.stopPropagation()} 
      onPointerDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 bg-background z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onSelect={() => handleSelect('EN_PROCESO')}>
            En Proceso
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleSelect('SOLUCIONADO')}>
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
                  if (e.key === 'Enter') handleCustomSubmit();
                }}
                className="h-8"
              />
              <Button 
                size="sm" 
                className="h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCustomSubmit();
                }}
                disabled={!customEstado.trim()}
              >
                Enviar
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function PQRDashboard({ data, onSelectPQR, onCambiarEstado, updating }: PQRDashboardProps) {
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  // Filter and sort: anything NOT solucionado (pending, in-process, and custom statuses)
  const urgentPQRs = data
    .filter(pqr => {
      const estado = (pqr.estado || '').toLowerCase();
      return estado !== 'solucionado' && estado !== 'solved';
    })
    .sort((a, b) => {
      const dateA = parseSimpleDate(a.fecha);
      const dateB = parseSimpleDate(b.fecha);
      return dateB.getTime() - dateA.getTime();
    });

  const getPriorityStyles = (prioridad: string | undefined) => {
    switch ((prioridad || '').toLowerCase()) {
      case 'alta':
        return {
          border: 'border-l-4 border-l-destructive',
          badge: 'bg-destructive text-destructive-foreground',
          glow: 'shadow-destructive/20'
        };
      case 'media':
        return {
          border: 'border-l-4 border-l-warning',
          badge: 'bg-warning text-warning-foreground',
          glow: 'shadow-warning/20'
        };
      case 'baja':
        return {
          border: 'border-l-4 border-l-success',
          badge: 'bg-success text-success-foreground',
          glow: 'shadow-success/20'
        };
      default:
        return {
          border: 'border-l-4 border-l-muted',
          badge: 'bg-muted text-muted-foreground',
          glow: ''
        };
    }
  };

  const getStatusStyles = (estado: string | undefined) => {
    const estadoLower = (estado || '').toLowerCase();
    switch (estadoLower) {
      case 'pendiente':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'en_proceso':
      case 'en proceso':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'solucionado':
      case 'solved':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-300';
    }
  };

  const handleRequestChange = (id: number, nuevoEstado: string, currentEstado: string) => {
    setPendingChange({ id, nuevoEstado, currentEstado });
  };

  const handleConfirmChange = async () => {
    if (pendingChange) {
      await onCambiarEstado(pendingChange.id, pendingChange.nuevoEstado);
      setPendingChange(null);
    }
  };

  const renderThumbnail = (pqr: PQRItem) => {
    const imgData = IMAGE_FIELDS.map(f => pqr[f]).find(v => !!v);
    
    if (!imgData) {
      return (
        <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-lg flex-shrink-0">
          <Image className="h-6 w-6 text-muted-foreground" />
        </div>
      );
    }

    let src = String(imgData);
    if (!src.startsWith('data:')) {
      const mime = (pqr.imagen_mime as string) || 'image/jpeg';
      src = `data:${mime};base64,${src}`;
    }

    return (
      <img 
        src={src} 
        alt="PQR" 
        className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-muted"
      />
    );
  };

  if (urgentPQRs.length === 0) {
    return (
      <Card className="bg-card/50">
        <CardContent className="py-8 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">Sin PQR pendientes</h3>
          <p className="text-muted-foreground">
            No hay peticiones pendientes o en proceso por atender
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {urgentPQRs.map((pqr) => {
          const styles = getPriorityStyles(pqr.prioridad);
          const currentEstado = pqr.estado || 'Sin estado';
          
          return (
            <Card 
              key={pqr.id}
              className={cn(
                "cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden",
                styles.border,
                styles.glow && `shadow-md ${styles.glow}`
              )}
              onClick={() => onSelectPQR(pqr)}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {renderThumbnail(pqr)}
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={cn("text-xs", styles.badge)}>
                          {(pqr.prioridad || 'N/A').toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs flex items-center gap-1", getStatusStyles(pqr.estado))}>
                          <Activity className="h-3 w-3" />
                          {currentEstado}
                        </Badge>
                      </div>
                      
                      <PQRCardDropdown
                        pqrId={pqr.id}
                        currentEstado={currentEstado}
                        isUpdating={updating === pqr.id}
                        onRequestChange={handleRequestChange}
                      />
                    </div>
                    
                    <div className="flex items-start gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm line-clamp-2">{pqr.descripcion_problema || pqr.descripcion || '-'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{pqr.nombre || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{pqr.telefono || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{pqr.direccion || '-'} - {pqr.barrio || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{pqr.fecha || '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingChange} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de estado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea cambiar el estado de la PQR #{pendingChange?.id} de <strong>"{pendingChange?.currentEstado}"</strong> a <strong>"{pendingChange?.nuevoEstado}"</strong>?
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

function parseSimpleDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return new Date(dateStr);
}
