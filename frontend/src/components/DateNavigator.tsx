import { Button } from '@/components/ui/button';
import { 
  format, 
  addDays, 
  subDays, 
  addWeeks, 
  subWeeks, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateMode = 'todo' | 'dia' | 'semana' | 'mes';

interface DateNavigatorProps {
  mode: DateMode;
  setMode: (mode: DateMode) => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  onDateRangeChange: (from: Date, to: Date) => void;
}

export default function DateNavigator({ 
  mode, 
  setMode, 
  currentDate, 
  setCurrentDate,
  onDateRangeChange 
}: DateNavigatorProps) {
  
  const modes: { value: DateMode; label: string }[] = [
    { value: 'todo', label: 'Todo' },
    { value: 'dia', label: 'Día' },
    { value: 'semana', label: 'Semana' },
    { value: 'mes', label: 'Mes' },
  ];

  const handleModeChange = (newMode: DateMode) => {
    setMode(newMode);
    updateDateRange(newMode, currentDate);
  };

  const updateDateRange = (m: DateMode, date: Date) => {
    switch (m) {
      case 'todo':
        // Last 365 days
        onDateRangeChange(subDays(new Date(), 365), new Date());
        break;
      case 'dia':
        onDateRangeChange(date, date);
        break;
      case 'semana':
        onDateRangeChange(
          startOfWeek(date, { locale: es }),
          endOfWeek(date, { locale: es })
        );
        break;
      case 'mes':
        onDateRangeChange(
          startOfMonth(date),
          endOfMonth(date)
        );
        break;
    }
  };

  const navigatePrev = () => {
    let newDate: Date;
    switch (mode) {
      case 'dia':
        newDate = subDays(currentDate, 1);
        break;
      case 'semana':
        newDate = subWeeks(currentDate, 1);
        break;
      case 'mes':
        newDate = subMonths(currentDate, 1);
        break;
      default:
        return;
    }
    setCurrentDate(newDate);
    updateDateRange(mode, newDate);
  };

  const navigateNext = () => {
    let newDate: Date;
    switch (mode) {
      case 'dia':
        newDate = addDays(currentDate, 1);
        break;
      case 'semana':
        newDate = addWeeks(currentDate, 1);
        break;
      case 'mes':
        newDate = addMonths(currentDate, 1);
        break;
      default:
        return;
    }
    setCurrentDate(newDate);
    updateDateRange(mode, newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    updateDateRange(mode, today);
  };

  const getDisplayText = () => {
    switch (mode) {
      case 'todo':
        return 'Todos los registros';
      case 'dia':
        return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es });
      case 'semana': {
        const weekStart = startOfWeek(currentDate, { locale: es });
        const weekEnd = endOfWeek(currentDate, { locale: es });
        return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, "d MMM 'de' yyyy", { locale: es })}`;
      }
      case 'mes':
        return format(currentDate, "MMMM 'de' yyyy", { locale: es });
    }
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Fecha:</span>
        <div className="flex rounded-lg bg-muted p-1">
          {modes.map((m) => (
            <Button
              key={m.value}
              variant="ghost"
              size="sm"
              onClick={() => handleModeChange(m.value)}
              className={cn(
                "h-auto rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === m.value 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {mode !== 'todo' && (
        <div className="flex items-center justify-start gap-2 lg:justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={navigatePrev}
            className="h-8 w-8 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="min-w-[220px] text-center lg:min-w-[280px]">
            <p className="text-sm font-semibold text-foreground capitalize">
              {getDisplayText()}
            </p>
            <button 
              onClick={goToToday}
              className="text-xs text-accent hover:underline"
            >
              Volver a hoy
            </button>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={navigateNext}
            className="h-8 w-8 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
