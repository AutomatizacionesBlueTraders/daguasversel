import { useState, useRef, useEffect, useCallback } from 'react';
import { N8N_WEBHOOK_URL } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DollarSign, 
  Calendar,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Deudor {
  codigo: string;
  identificacion: string | null;
  nombre: string;
  direccion: string;
  factura: string;
  facturado: number;
  uso_estrato: string;
  periodo: string;
  anio: string;
  telefono: string | null;
  total_adeudado: number;
  mesesendeuda: number;
  recaudado: string;
}

interface DeudoresResponse {
  deudores?: Deudor[];
  total_registros?: number;
}

function DualScrollTable({ deudores, formatCurrency, getMoraColor }: { 
  deudores: Deudor[]; 
  formatCurrency: (v: number) => string; 
  getMoraColor: (m: number) => string; 
}) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const syncing = useRef(false);

  useEffect(() => {
    const updateWidth = () => {
      if (bottomScrollRef.current) {
        setTableWidth(bottomScrollRef.current.scrollWidth);
      }
    };
    // Small delay to ensure table is rendered
    const timer = setTimeout(updateWidth, 100);
    return () => clearTimeout(timer);
  }, [deudores]);

  const handleTopScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  const handleBottomScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  return (
    <>
      {/* Scrollbar superior */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto border rounded-md bg-muted/30 mb-2"
        style={{ overflowY: 'hidden', height: 20 }}
      >
        <div style={{ width: tableWidth, height: 1 }} />
      </div>

      {/* Tabla con scrollbar inferior */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className="overflow-x-auto [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full"
      >
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
              <TableHead className="text-center">Meses Mora</TableHead>
              <TableHead className="text-right">Recaudado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deudores.map((deudor, index) => (
              <TableRow key={`${deudor.codigo}-${index}`}>
                <TableCell className="font-mono text-xs">{deudor.codigo}</TableCell>
                <TableCell className="font-medium">{deudor.nombre}</TableCell>
                <TableCell>{deudor.identificacion || '-'}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={deudor.direccion}>
                  {deudor.direccion}
                </TableCell>
                <TableCell>{deudor.telefono || '-'}</TableCell>
                <TableCell>{deudor.factura}</TableCell>
                <TableCell className="text-xs">{deudor.uso_estrato}</TableCell>
                <TableCell>{deudor.periodo}/{deudor.anio}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(deudor.facturado)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(deudor.total_adeudado)}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMoraColor(deudor.mesesendeuda)}`}>
                    {deudor.mesesendeuda} {deudor.mesesendeuda === 1 ? 'mes' : 'meses'}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(deudor.recaudado) || 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          
        </table>
      </div>
    </>
  );
}

export default function Deudores() {
  const { role } = useAuth();
  const [valorMinimo, setValorMinimo] = useState('');
  const [valorMaximo, setValorMaximo] = useState('');
  const [mesesMoraMinimo, setMesesMoraMinimo] = useState('');
  const [mesesMoraMaximo, setMesesMoraMaximo] = useState('');
  
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // Calcular datos paginados
  const totalPages = Math.ceil(deudores.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDeudores = deudores.slice(startIndex, endIndex);

  

  const buscarPorValor = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accion: 'buscar_deudores_valor',
          valor_minimo: valorMinimo ? parseFloat(valorMinimo) : 0,
          valor_maximo: valorMaximo ? parseFloat(valorMaximo) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al buscar deudores');
      }

      const text = await response.text();
      // Response logged internally
      if (!text || text.trim() === '') {
        toast.error('El servidor devolvió una respuesta vacía');
        setDeudores([]);
        setTotalRegistros(0);
        return;
      }
      const data = JSON.parse(text);
      handleResponse(data);
    } catch (error) {
      // Error handled via toast
      toast.error('Error al buscar deudores');
      setDeudores([]);
      setTotalRegistros(0);
    } finally {
      setLoading(false);
    }
  };

  const buscarPorMora = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accion: 'buscar_deudores_meses',
          meses_mora_minimo: mesesMoraMinimo ? parseInt(mesesMoraMinimo) : 0,
          meses_mora_maximo: mesesMoraMaximo ? parseInt(mesesMoraMaximo) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al buscar deudores');
      }

      const text = await response.text();
      // Response logged internally
      if (!text || text.trim() === '') {
        toast.error('El servidor devolvió una respuesta vacía');
        setDeudores([]);
        setTotalRegistros(0);
        return;
      }
      const data = JSON.parse(text);
      handleResponse(data);
    } catch (error) {
      // Error handled via toast
      toast.error('Error al buscar deudores');
      setDeudores([]);
      setTotalRegistros(0);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (data: unknown) => {
    setCurrentPage(1); // Reset a primera página
    if (Array.isArray(data)) {
      setDeudores(data as Deudor[]);
      setTotalRegistros(data.length);
      return;
    }

    if (data && typeof data === 'object' && 'deudores' in data) {
      const response = data as DeudoresResponse;
      const deudores = Array.isArray(response.deudores) ? response.deudores : [];
      setDeudores(deudores);
      setTotalRegistros(response.total_registros || deudores.length);
      return;
    }

    setDeudores([]);
    setTotalRegistros(0);
  };

  const limpiarFiltros = () => {
    setValorMinimo('');
    setValorMaximo('');
    setMesesMoraMinimo('');
    setMesesMoraMaximo('');
    setDeudores([]);
    setTotalRegistros(0);
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

  const getMoraColor = (meses: number) => {
    if (meses >= 6) return 'text-red-600 bg-red-100';
    if (meses >= 3) return 'text-amber-600 bg-amber-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Búsqueda de Deudores</h1>
          <p className="text-muted-foreground">Consulta de información de cartera</p>
        </div>
      </div>

      {/* Search Filters */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Por Valor Adeudado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Buscar por Valor Adeudado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Valor Mínimo</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={valorMinimo}
                  onChange={(e) => setValorMinimo(e.target.value)}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Máximo</Label>
                <Input
                  type="number"
                  placeholder="Sin límite"
                  value={valorMaximo}
                  onChange={(e) => setValorMaximo(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={buscarPorValor} 
                disabled={loading || (!valorMinimo && !valorMaximo)}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar por Valor
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setValorMinimo('');
                  setValorMaximo('');
                }} 
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Por Meses en Mora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Buscar por Meses en Mora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Meses Mínimo</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={mesesMoraMinimo}
                  onChange={(e) => setMesesMoraMinimo(e.target.value)}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Meses Máximo</Label>
                <Input
                  type="number"
                  placeholder="Sin límite"
                  value={mesesMoraMaximo}
                  onChange={(e) => setMesesMoraMaximo(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={buscarPorMora} 
                disabled={loading || (!mesesMoraMinimo && !mesesMoraMaximo)}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar por Mora
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setMesesMoraMinimo('');
                  setMesesMoraMaximo('');
                }} 
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Limpiar Todo */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={limpiarFiltros} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Limpiar Todos los Filtros
        </Button>
      </div>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados</span>
              <span className="text-sm font-normal text-muted-foreground">
                {totalRegistros} registro(s) encontrado(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : deudores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>No se encontraron deudores con los filtros aplicados</p>
              </div>
            ) : (
              <>
                <DualScrollTable deudores={paginatedDeudores} formatCurrency={formatCurrency} getMoraColor={getMoraColor} />

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} - {Math.min(endIndex, deudores.length)} de {deudores.length} registros
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
