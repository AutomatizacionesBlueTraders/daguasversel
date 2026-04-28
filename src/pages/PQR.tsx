import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { usePQR } from '@/hooks/usePQR';
import { useAuth } from '@/hooks/useAuth';
import { PQRItem, EstadoFilter, HIDDEN_FIELDS, IMAGE_FIELDS, getFieldLabel } from '@/types/pqr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCw, AlertCircle, Sparkles, Image, Loader2, LayoutDashboard, List, Clock, CheckCircle, Hourglass, HelpCircle, Download, ZoomIn, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import DateNavigator from '@/components/DateNavigator';
import PQRDashboard from '@/components/PQRDashboard';
import PQRStatusChanger from '@/components/PQRStatusChanger';

// n8n webhook URL for PQR data
import { N8N_WEBHOOK_URL as N8N_BASE_URL } from '@/lib/constants';

type DateMode = 'todo' | 'dia' | 'semana' | 'mes';

// Get visible field keys from a PQR item (excluding hidden/image fields)
function getVisibleFields(item: PQRItem): string[] {
  return Object.keys(item).filter(key => !HIDDEN_FIELDS.includes(key));
}

// Find the first image field with data
function getImageData(item: PQRItem): string | null {
  for (const field of IMAGE_FIELDS) {
    if (item[field]) return String(item[field]);
  }
  return null;
}

export default function PQR() {
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 7));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [estado, setEstado] = useState<EstadoFilter>('TODOS');
  const [selectedPQR, setSelectedPQR] = useState<PQRItem | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>('semana');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'dashboard' | 'lista'>('dashboard');
  const [tipoPQR, setTipoPQR] = useState<'reportc' | 'reportd'>('reportc');
  const [imageOpen, setImageOpen] = useState(false);
  
  const { role } = useAuth();
  
  const { data, counters, loading, updating, error, fetchPQR, cambiarEstado, isNew, newCount } = usePQR({ 
    n8nBaseUrl: N8N_BASE_URL,
    userRole: role,
    tipoPQR,
  });

  const handleDateRangeChange = useCallback((from: Date, to: Date) => {
    setFromDate(from);
    setToDate(to);
  }, []);

  const handleFetch = useCallback(() => {
    if (fromDate > toDate) {
      return;
    }
    fetchPQR(fromDate, toDate, estado);
  }, [fromDate, toDate, estado, fetchPQR]);

  // Fetch when dates or filters change
  useEffect(() => {
    if (N8N_BASE_URL) {
      handleFetch();
    }
  }, [handleFetch, tipoPQR]);

  // Initial load - set week range
  useEffect(() => {
    if (N8N_BASE_URL) {
      const today = new Date();
      setFromDate(startOfWeek(today, { locale: es }));
      setToDate(endOfWeek(today, { locale: es }));
    }
  }, []);

  const getPrioridadColor = (prioridad: string | undefined) => {
    switch ((prioridad || '').toLowerCase()) {
      case 'alta': return 'bg-destructive text-destructive-foreground';
      case 'media': return 'bg-warning text-warning-foreground';
      case 'baja': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getEstadoColor = (estado: string | undefined) => {
    const estadoLower = (estado || '').toLowerCase();
    if (estadoLower === 'pendiente' || estadoLower === 'pending') {
      return 'bg-warning/20 text-warning border-warning/30';
    }
    if (estadoLower === 'en_proceso' || estadoLower === 'en proceso') {
      return 'bg-accent/20 text-accent border-accent/30';
    }
    if (estadoLower === 'solucionado') {
      return 'bg-success/20 text-success border-success/30';
    }
    return 'bg-muted text-muted-foreground';
  };

  const getImageSrc = (item: PQRItem): string | null => {
    const imgData = getImageData(item);
    if (!imgData) return null;
    if (imgData.startsWith('data:')) return imgData;
    const mime = item.imagen_mime || 'image/jpeg';
    return `data:${mime};base64,${imgData}`;
  };

  const handleDownloadImage = (item: PQRItem) => {
    const src = getImageSrc(item);
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `PQR_${item.id || 'imagen'}.jpg`;
    link.click();
  };

  // Determine which columns to show in table based on all data
  const tableColumns = (() => {
    if (data.length === 0) return ['fecha', 'estado', 'descripcion_problema'];
    const allKeys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!HIDDEN_FIELDS.includes(key)) allKeys.add(key);
      });
    });
    // Prioritize known columns, then add any extras
    const priority = ['id', 'fecha', 'estado', 'prioridad', 'barrio', 'descripcion_problema', 'descripcion', 'nombre', 'tipo'];
    const ordered: string[] = [];
    priority.forEach(k => { if (allKeys.has(k)) { ordered.push(k); allKeys.delete(k); } });
    allKeys.forEach(k => ordered.push(k));
    return ordered;
  })();

  // Render a cell value with special formatting for known fields
  const renderCellValue = (key: string, value: unknown): ReactNode => {
    if (value === null || value === undefined) return '-';
    const strValue = String(value);
    if (key === 'prioridad') {
      return <Badge className={getPrioridadColor(strValue)}>{strValue || 'Sin prioridad'}</Badge>;
    }
    if (key === 'estado') {
      return (
        <Badge variant="outline" className={getEstadoColor(strValue)}>
          {strValue.replace('_', ' ') || 'Sin estado'}
        </Badge>
      );
    }
    return strValue;
  };

  if (!N8N_BASE_URL) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quejas y Reclamos</h1>
          <p className="text-muted-foreground">Gestión de PQR</p>
        </div>
        
        <Card className="border-warning/50">
          <CardContent className="flex items-center gap-4 py-6">
            <AlertCircle className="h-8 w-8 text-warning" />
            <div>
              <h3 className="font-semibold">Webhook no configurado</h3>
              <p className="text-sm text-muted-foreground">
                Debe configurar la URL del webhook de n8n para cargar las PQR.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quejas y Reclamos</h1>
          <p className="text-muted-foreground">
            {data.length} registros {newCount > 0 && `(${newCount} nuevas)`}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('dashboard')}
            className={cn(
              "px-3 py-1.5 h-auto text-sm font-medium rounded-md transition-colors gap-2",
              viewMode === 'dashboard' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('lista')}
            className={cn(
              "px-3 py-1.5 h-auto text-sm font-medium rounded-md transition-colors gap-2",
              viewMode === 'lista' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <List className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counters.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-warning/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">{counters.pendientes}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-accent/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Hourglass className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{counters.en_proceso}</p>
              <p className="text-xs text-muted-foreground">En Proceso</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-success/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{counters.solucionados}</p>
              <p className="text-xs text-muted-foreground">Solucionados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-muted-foreground/30 col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{counters.otros}</p>
              <p className="text-xs text-muted-foreground">Otros</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <DateNavigator
              mode={dateMode}
              setMode={setDateMode}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              onDateRangeChange={handleDateRangeChange}
            />

            <div className="flex gap-3 items-end flex-wrap">
              {(role === 'admin' || role === 'usuario') && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tipo PQR</label>
                  <Select value={tipoPQR} onValueChange={(v) => setTipoPQR(v as 'reportc' | 'reportd')}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reportc">Comercial</SelectItem>
                      <SelectItem value="reportd">Operativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Estado</label>
                <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFilter)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="EN_PROCESO">En proceso</SelectItem>
                    <SelectItem value="SOLUCIONADO">Solucionado</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleFetch} disabled={loading || fromDate > toDate}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Actualizar
              </Button>
            </div>
          </div>

          {fromDate > toDate && (
            <p className="text-sm text-destructive mt-2">
              La fecha inicial no puede ser mayor que la fecha final
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-4 py-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h3 className="font-semibold">Error al cargar datos</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content based on view mode */}
      {viewMode === 'dashboard' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">PQR Prioritarias</h2>
             <p className="text-sm text-muted-foreground mb-4">
              Peticiones pendientes y en proceso ordenadas por fecha más reciente
            </p>
          </div>
          <PQRDashboard 
            data={data}
            onSelectPQR={setSelectedPQR}
            onCambiarEstado={cambiarEstado}
            updating={updating}
          />
        </div>
      ) : (
        /* Dynamic data table */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20"></TableHead>
                    {tableColumns.map(col => (
                      <TableHead key={col} className={col.includes('descripcion') ? 'max-w-xs' : ''}>
                        {getFieldLabel(col)}
                      </TableHead>
                    ))}
                    <TableHead className="w-40 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-6 w-14" /></TableCell>
                        {tableColumns.map(col => (
                          <TableCell key={col}><Skeleton className="h-4 w-24" /></TableCell>
                        ))}
                        <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableColumns.length + 2} className="text-center py-8 text-muted-foreground">
                        No se encontraron registros
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedPQR(item)}
                      >
                        <TableCell>
                          {isNew(item.id) && (
                            <Badge className="bg-accent text-accent-foreground">
                              <Sparkles className="h-3 w-3 mr-1" />
                              NUEVA
                            </Badge>
                          )}
                        </TableCell>
                        {tableColumns.map(col => (
                          <TableCell 
                            key={col} 
                            className={cn(
                              col.includes('descripcion') && 'max-w-xs truncate',
                              col === 'fecha' && 'whitespace-nowrap',
                              col === 'id' && 'font-mono text-sm'
                            )}
                          >
                            {renderCellValue(col, item[col])}
                          </TableCell>
                        ))}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <PQRStatusChanger
                            pqrId={item.id}
                            currentEstado={item.estado || 'Sin estado'}
                            onCambiarEstado={cambiarEstado}
                            updating={updating}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Sheet - Dynamic fields */}
      <Sheet open={!!selectedPQR} onOpenChange={() => setSelectedPQR(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedPQR && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Registro #{selectedPQR.id}
                  {isNew(selectedPQR.id) && (
                    <Badge className="bg-accent text-accent-foreground">
                      <Sparkles className="h-3 w-3 mr-1" />
                      NUEVA
                    </Badge>
                  )}
                </SheetTitle>
              </SheetHeader>

               <div className="mt-6 space-y-6">
                {/* Status + Estado badge */}
                <div className="flex items-center justify-between">
                  <Badge className={cn("text-sm px-3 py-1", getEstadoColor(selectedPQR.estado))}>
                    {selectedPQR.estado || 'Sin estado'}
                  </Badge>
                  <PQRStatusChanger
                    pqrId={selectedPQR.id}
                    currentEstado={selectedPQR.estado || 'Sin estado'}
                    onCambiarEstado={async (id, nuevoEstado) => {
                      const success = await cambiarEstado(id, nuevoEstado);
                      if (success) {
                        setSelectedPQR(prev => prev ? { ...prev, estado: nuevoEstado } : null);
                      }
                      return success;
                    }}
                    updating={updating}
                  />
                </div>

                {/* Image section */}
                {(() => {
                  const imgSrc = getImageSrc(selectedPQR);
                  return imgSrc ? (
                    <Card>
                      <CardContent className="pt-4">
                        <div className="relative group">
                          <img 
                            src={imgSrc} 
                            alt="Imagen de la PQR" 
                            className="w-full max-h-72 object-contain rounded-lg bg-muted cursor-pointer"
                            onClick={() => setImageOpen(true)}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setImageOpen(true)}>
                            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => setImageOpen(true)}>
                            <ZoomIn className="h-4 w-4 mr-1" /> Ver imagen
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDownloadImage(selectedPQR)}>
                            <Download className="h-4 w-4 mr-1" /> Descargar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 bg-muted rounded-lg">
                      <Image className="h-8 w-8 text-muted-foreground mb-1" />
                      <p className="text-sm text-muted-foreground">Sin imagen</p>
                    </div>
                  );
                })()}

                {/* Details table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Detalles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-border">
                        {getVisibleFields(selectedPQR).map((key) => (
                          <tr key={key}>
                            <td className="py-2.5 font-medium text-muted-foreground w-1/3 align-top">
                              {getFieldLabel(key)}
                            </td>
                            <td className="py-2.5 break-words">
                              {renderCellValue(key, selectedPQR[key])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Image Lightbox */}
      {selectedPQR && (
        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] p-2 flex flex-col">
            <div className="flex justify-start gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => handleDownloadImage(selectedPQR)}>
                <Download className="h-4 w-4 mr-1" /> Descargar
              </Button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-muted rounded-lg">
              {getImageSrc(selectedPQR) && (
                <img 
                  src={getImageSrc(selectedPQR)!} 
                  alt="Imagen de la PQR" 
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
