import { useState, useCallback, useRef } from 'react';
import { PQRItem, PQRResponse, EstadoFilter } from '@/types/pqr';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'admin' | 'usuario' | 'tecnico';

interface UsePQROptions {
  n8nBaseUrl?: string;
  userRole?: AppRole | null;
  tipoPQR?: 'reportc' | 'reportd';
}

export interface PQRCounters {
  total: number;
  pendientes: number;
  en_proceso: number;
  solucionados: number;
  otros: number;
}

// Map database role to n8n tipo value
function getRoleTypeForN8n(role: AppRole | null): string {
  switch (role) {
    case 'admin': return 'administrador';
    case 'tecnico': return 'tecnico';
    case 'usuario': return 'administrativo';
    default: return 'administrativo';
  }
}

export function usePQR({ n8nBaseUrl, userRole, tipoPQR = 'reportc' }: UsePQROptions = {}) {
  const [data, setData] = useState<PQRItem[]>([]);
  const [counters, setCounters] = useState<PQRCounters>({ total: 0, pendientes: 0, en_proceso: 0, solucionados: 0, otros: 0 });
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const previousIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);
  const { toast } = useToast();

  const fetchPQR = useCallback(async (
    from: Date,
    to: Date,
    estado: EstadoFilter = 'TODOS'
  ) => {
    if (!n8nBaseUrl) {
      setError('URL del webhook no configurada');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build ISO strings with local timezone offset (-05:00)
      const pad = (n: number) => n.toString().padStart(2, '0');
      const fromYear = from.getFullYear();
      const fromMonth = pad(from.getMonth() + 1);
      const fromDay = pad(from.getDate());
      const fromStr = `${fromYear}-${fromMonth}-${fromDay}T00:00:00.000-05:00`;

      const toYear = to.getFullYear();
      const toMonth = pad(to.getMonth() + 1);
      const toDay = pad(to.getDate());
      const toStr = `${toYear}-${toMonth}-${toDay}T23:59:59.999-05:00`;
      
      // For "OTRO" filter, we need to fetch all and filter locally
      // because n8n doesn't understand custom status names
      const estadoToSend = estado === 'OTRO' ? 'TODOS' : 
                           estado === 'EN_PROCESO' ? 'EN PROCESO' : estado;

      const response = await fetch(n8nBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accion: 'actualizar',
          from: fromStr,
          to: toStr,
          estado: estadoToSend,
          tipo: getRoleTypeForN8n(userRole),
          report: tipoPQR,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // New format: first element is counters, rest are PQR items
      let items: PQRItem[] = [];
      let rawCounters: PQRCounters | null = null;
      
      if (Array.isArray(result)) {
        // Check if first element is counters object (has 'total' property)
        if (result.length > 0 && typeof result[0] === 'object' && 'total' in result[0]) {
          rawCounters = result[0] as PQRCounters;
          items = result.slice(1) as PQRItem[];
        } else {
          // Old format: entire array is PQR items
          items = result as PQRItem[];
        }
      } else if (result.data) {
        items = result.data;
      }
      
      // Filter out empty items (n8n sometimes returns empty objects)
      items = items.filter(item => {
        // An item is valid if it has at least some meaningful content (any non-null field besides id)
        if (!item || typeof item !== 'object') return false;
        const keys = Object.keys(item);
        if (keys.length === 0) return false;
        // Must have at least one non-null value
        return keys.some(k => item[k] !== null && item[k] !== undefined && item[k] !== '');
      });
      
      // Calculate new items (only after first load and when user clicks "Actualizar")
      const currentIds = new Set(items.map(item => item.id));
      
      if (!isFirstLoad.current) {
        // Find new IDs that weren't in the previous set
        const newlyAddedIds = new Set<number>();
        currentIds.forEach(id => {
          if (!previousIdsRef.current.has(id)) {
            newlyAddedIds.add(id);
          }
        });
        setNewIds(newlyAddedIds);
        
        if (newlyAddedIds.size > 0) {
          toast({
            title: 'Nuevas PQR detectadas',
            description: `Se encontraron ${newlyAddedIds.size} nueva(s) PQR.`,
          });
        }
      } else {
        setNewIds(new Set());
        isFirstLoad.current = false;
      }

      // Update previous IDs for next comparison
      previousIdsRef.current = currentIds;

      // If "OTRO" filter was requested, filter locally for custom statuses
      if (estado === 'OTRO') {
        items = items.filter(item => {
          const itemEstado = (item.estado || '').toLowerCase();
          return itemEstado !== 'pendiente' && 
                 itemEstado !== 'pending' && 
                 itemEstado !== 'en_proceso' && 
                 itemEstado !== 'en proceso' && 
                 itemEstado !== 'solucionado' && 
                 itemEstado !== 'solved';
        });
      }

      // Sort by date descending (defensive: handle missing/null fecha)
      items.sort((a, b) => {
        const dateA = parseDate(a?.fecha ?? null);
        const dateB = parseDate(b?.fecha ?? null);
        return dateB.getTime() - dateA.getTime();
      });

      // Calculate counters AFTER filtering (so counters match displayed data)
      const calculatedCounters = calculateCountersFromItems(items);
      setCounters(calculatedCounters);

      setData(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar datos';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [n8nBaseUrl, userRole, tipoPQR, toast]);

  const cambiarEstado = useCallback(async (
    id: number,
    nuevoEstado: string
  ) => {
    if (!n8nBaseUrl) {
      toast({
        title: 'Error',
        description: 'URL del webhook no configurada',
        variant: 'destructive',
      });
      return false;
    }

    setUpdating(id);

    try {
      const response = await fetch(n8nBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accion: 'cambiar_estado',
          id: id,
          nuevo_estado: nuevoEstado,
          tipo: getRoleTypeForN8n(userRole),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Update local state
      setData(prev => prev.map(item => 
        item.id === id ? { ...item, estado: nuevoEstado as PQRItem['estado'] } : item
      ));

      toast({
        title: 'Estado actualizado',
        description: `El estado se cambió a "${nuevoEstado}"`,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cambiar estado';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setUpdating(null);
    }
  }, [n8nBaseUrl, userRole, toast]);

  const isNew = useCallback((id: number) => newIds.has(id), [newIds]);

  return {
    data,
    counters,
    loading,
    updating,
    error,
    fetchPQR,
    cambiarEstado,
    isNew,
    newCount: newIds.size,
  };
}

// Calculate counters from items - handles custom statuses as "otros"
function calculateCountersFromItems(items: PQRItem[]): PQRCounters {
  const counters: PQRCounters = { total: 0, pendientes: 0, en_proceso: 0, solucionados: 0, otros: 0 };
  
  items.forEach(item => {
    counters.total++;
    const estado = (item.estado || '').toLowerCase();
    
    if (estado === 'pendiente' || estado === 'pending') {
      counters.pendientes++;
    } else if (estado === 'en_proceso' || estado === 'en proceso') {
      counters.en_proceso++;
    } else if (estado === 'solucionado' || estado === 'solved') {
      counters.solucionados++;
    } else {
      // Any custom status counts as "otros"
      counters.otros++;
    }
  });
  
  return counters;
}

// Parse date in format "DD-MM-YYYY HH:mm", "DD/MM/YYYY" or "YYYY-MM-DD"
function parseDate(dateStr: string | undefined | null): Date {
  if (!dateStr) {
    return new Date(0); // Return epoch for undefined/null dates
  }
  
  // Try DD-MM-YYYY HH:mm format
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  
  // Try DD/MM/YYYY format
  const matchSlash = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchSlash) {
    const [, day, month, year] = matchSlash;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Fallback to ISO format
  return new Date(dateStr);
}
