import { useState, useRef, useEffect, useCallback } from 'react';
import { N8N_WEBHOOK_URL } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

type TipoBusqueda = 'codigo' | 'identificacion' | 'nombre';

interface FacturacionUsuario {
  codigo: string;
  identificacion: string;
  nombre: string;
  direccion: string;
  factura: string;
  facturado: string | number;
  uso_estrato: string;
  periodo: string | number;
  anio: string | number;
  telefono: string;
  total_adeudado: number;
  mesesendeuda: number;
  recaudado: string | number;
}

interface FacturacionResponse {
  data?: FacturacionUsuario[];
  resultados?: FacturacionUsuario[];
}

export default function FacturacionUsuarios() {
  const [tipoBusqueda, setTipoBusqueda] = useState<TipoBusqueda>('codigo');
  const [valorBusqueda, setValorBusqueda] = useState('');
  const [resultados, setResultados] = useState<FacturacionUsuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);

  const syncScrollWidths = useCallback(() => {
    if (tableScrollRef.current && topScrollInnerRef.current) {
      topScrollInnerRef.current.style.width = tableScrollRef.current.scrollWidth + 'px';
    }
  }, []);

  useEffect(() => {
    syncScrollWidths();
  }, [resultados, syncScrollWidths]);

  useEffect(() => {
    const topEl = topScrollRef.current;
    const bottomEl = tableScrollRef.current;
    if (!topEl || !bottomEl) return;

    let syncing = false;
    const onTopScroll = () => {
      if (syncing) return;
      syncing = true;
      bottomEl.scrollLeft = topEl.scrollLeft;
      syncing = false;
    };
    const onBottomScroll = () => {
      if (syncing) return;
      syncing = true;
      topEl.scrollLeft = bottomEl.scrollLeft;
      syncing = false;
    };
    topEl.addEventListener('scroll', onTopScroll);
    bottomEl.addEventListener('scroll', onBottomScroll);
    return () => {
      topEl.removeEventListener('scroll', onTopScroll);
      bottomEl.removeEventListener('scroll', onBottomScroll);
    };
  }, [resultados]);

  // Calcular datos paginados
  const totalPages = Math.ceil(resultados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedResultados = resultados.slice(startIndex, endIndex);

  

  const buscar = async () => {
    if (!valorBusqueda.trim()) {
      toast.error('Por favor ingrese un valor para buscar');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accion: `buscar_facturacion_${tipoBusqueda}`,
          [tipoBusqueda]: valorBusqueda.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Error al buscar información de facturación');
      }

      const data = await response.json();
      handleResponse(data);
    } catch (error) {
      // Error handled via toast
      toast.error('Error al buscar información de facturación');
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (data: unknown) => {
    setCurrentPage(1);
    if (Array.isArray(data)) {
      setResultados(data as FacturacionUsuario[]);
      return;
    }

    if (data && typeof data === 'object') {
      const response = data as FacturacionResponse;
      if (Array.isArray(response.data)) {
        setResultados(response.data);
        return;
      }
      if (Array.isArray(response.resultados)) {
        setResultados(response.resultados);
        return;
      }
    }

    setResultados([]);
  };

  const limpiar = () => {
    setValorBusqueda('');
    setResultados([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getPlaceholder = () => {
    switch (tipoBusqueda) {
      case 'codigo':
        return 'Ingrese el código del usuario';
      case 'identificacion':
        return 'Ingrese la identificación del usuario';
      case 'nombre':
        return 'Ingrese el nombre del usuario';
      default:
        return 'Ingrese el valor a buscar';
    }
  };

  const getLabel = () => {
    switch (tipoBusqueda) {
      case 'codigo':
        return 'Código del Usuario';
      case 'identificacion':
        return 'Identificación del Usuario';
      case 'nombre':
        return 'Nombre del Usuario';
      default:
        return 'Valor a Buscar';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Información de Facturación Usuarios</h1>
          <p className="text-muted-foreground">Consulta de información de facturación por usuario</p>
        </div>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Buscar Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Tipo de búsqueda */}
            <div className="space-y-2">
              <Label>Buscar por</Label>
              <Select
                value={tipoBusqueda}
                onValueChange={(value: TipoBusqueda) => {
                  setTipoBusqueda(value);
                  setValorBusqueda('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione tipo de búsqueda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="codigo">Código</SelectItem>
                  <SelectItem value="identificacion">Identificación</SelectItem>
                  <SelectItem value="nombre">Nombre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor de búsqueda */}
            <div className="space-y-2">
              <Label>{getLabel()}</Label>
              <Input
                type="text"
                placeholder={getPlaceholder()}
                value={valorBusqueda}
                onChange={(e) => setValorBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && valorBusqueda.trim()) {
                    buscar();
                  }
                }}
              />
            </div>

            {/* Botones */}
            <div className="flex items-end gap-2">
              <Button 
                onClick={buscar} 
                disabled={loading || !valorBusqueda.trim()}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar
              </Button>
              <Button 
                variant="outline" 
                onClick={limpiar} 
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados</span>
              <span className="text-sm font-normal text-muted-foreground">
                {resultados.length} registro(s) encontrado(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : resultados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>No se encontró información para el usuario</p>
              </div>
            ) : (
              <>
                <div 
                  ref={topScrollRef}
                  className="overflow-x-auto overscroll-x-contain mb-2"
                >
                  <div ref={topScrollInnerRef} style={{ height: '1px' }}></div>
                </div>
                <div className="relative w-full overflow-auto overscroll-x-contain" ref={tableScrollRef}>
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Identificación</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Uso/Estrato</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Facturado</TableHead>
                        <TableHead className="text-right">Total Adeudado</TableHead>
                        <TableHead className="text-right">Recaudado</TableHead>
                        <TableHead className="text-center">Meses Mora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedResultados.map((resultado, index) => (
                        <TableRow key={resultado.codigo + '-' + index}>
                          <TableCell className="font-mono text-xs">{resultado.codigo}</TableCell>
                          <TableCell className="font-medium">{resultado.nombre}</TableCell>
                          <TableCell>{resultado.identificacion}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={resultado.direccion}>
                            {resultado.direccion}
                          </TableCell>
                          <TableCell>{resultado.telefono || '-'}</TableCell>
                          <TableCell>{resultado.factura}</TableCell>
                          <TableCell className="text-xs">{resultado.uso_estrato}</TableCell>
                          <TableCell>{resultado.periodo}/{resultado.anio}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(resultado.facturado))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(resultado.total_adeudado)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(resultado.recaudado))}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              resultado.mesesendeuda >= 6 
                                ? 'text-red-600 bg-red-100' 
                                : resultado.mesesendeuda >= 3 
                                  ? 'text-amber-600 bg-amber-100' 
                                  : 'text-green-600 bg-green-100'
                            }`}>
                              {resultado.mesesendeuda} {resultado.mesesendeuda === 1 ? 'mes' : 'meses'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} - {Math.min(endIndex, resultados.length)} de {resultados.length} registros
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPage(prev => Math.max(prev - 1, 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="text-sm font-medium px-3">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPage(prev => Math.min(prev + 1, totalPages));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
