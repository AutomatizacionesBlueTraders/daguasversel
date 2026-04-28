import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfWeek, startOfWeek } from "date-fns";
import { AlertCircle, CalendarDays, Filter, Loader2, MessagesSquare, RefreshCw, TrendingUp, UserPlus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { es } from "date-fns/locale";

import DateNavigator from "@/components/DateNavigator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { buildDateParam, DateMode, formatPeriodLabel } from "@/lib/bot-dashboard";
import { BotStatsGrouping, BotStatsPeriod, fetchBotStats } from "@/lib/bot-messages";

const PERIOD_CHART_CONFIG = {
  total: {
    label: "Mensajes",
    color: "hsl(var(--primary))",
  },
  usuarios: {
    label: "Usuarios unicos",
    color: "hsl(var(--accent))",
  },
};

const OPTION_CHART_CONFIG = {
  total: {
    label: "Interacciones",
    color: "hsl(var(--success))",
  },
};

export default function EstadisticasBot() {
  const [fromDate, setFromDate] = useState<Date>(startOfWeek(new Date(), { locale: es }));
  const [toDate, setToDate] = useState<Date>(endOfWeek(new Date(), { locale: es }));
  const [dateMode, setDateMode] = useState<DateMode>("semana");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [grouping, setGrouping] = useState<BotStatsGrouping>("dia");
  const [periods, setPeriods] = useState<BotStatsPeriod[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fromDateParam = useMemo(() => buildDateParam(fromDate), [fromDate]);
  const toDateParam = useMemo(() => buildDateParam(toDate), [toDate]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);

    try {
      const response = await fetchBotStats({
        desde: fromDateParam,
        hasta: toDateParam,
        agrupacion: grouping,
      });

      setPeriods(response.periodos ?? []);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "No se pudieron cargar las estadisticas";
      setStatsError(message);
      setPeriods([]);
    } finally {
      setStatsLoading(false);
    }
  }, [fromDateParam, grouping, toDateParam]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleDateRangeChange = useCallback((from: Date, to: Date) => {
    setFromDate(from);
    setToDate(to);
  }, []);

  const stats = useMemo(() => {
    return periods.reduce(
      (accumulator, period) => {
        accumulator.total += period.total;
        accumulator.people += period.usuarios_unicos;
        accumulator.newPeople += period.nuevos;
        accumulator.returning += period.recurrentes;
        return accumulator;
      },
      {
        total: 0,
        people: 0,
        newPeople: 0,
        returning: 0,
      },
    );
  }, [periods]);

  const periodChartData = useMemo(() => {
    return periods.map((period) => ({
      periodo: formatPeriodLabel(period.periodo, grouping),
      total: period.total,
      usuarios: period.usuarios_unicos,
    }));
  }, [grouping, periods]);

  const optionsChartData = useMemo(() => {
    const totals = new Map<string, number>();

    for (const period of periods) {
      for (const [option, count] of Object.entries(period.opciones)) {
        const key = option.trim() || "SIN OPCION";
        totals.set(key, (totals.get(key) || 0) + count);
      }
    }

    return [...totals.entries()]
      .map((option) => ({
        option: option[0],
        label: option[0].replace(/_/g, " "),
        total: option[1],
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 8);
  }, [periods]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estadisticas Bot</h1>
          <p className="text-muted-foreground">
            KPIs, tendencias y distribucion del uso del bot en el rango seleccionado.
          </p>
        </div>
        <Button onClick={() => void loadStats()} disabled={statsLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="bg-[linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.16))] p-4">
          <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Rango y contexto</p>
              <p className="text-xs text-muted-foreground">
                Cambia la ventana de tiempo y la agrupacion del tablero.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <DateNavigator
                mode={dateMode}
                setMode={setDateMode}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_220px]">
              <div className="rounded-xl border border-border/70 bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rango consultado
                </p>
                <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    {fromDateParam} a {toDateParam}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vista activa
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">Agrupacion: {grouping}</Badge>
                  <span className="text-sm text-muted-foreground">Resumen y analitica</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Agrupacion
                </p>
                <Select value={grouping} onValueChange={(value) => setGrouping(value as BotStatsGrouping)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Dia</SelectItem>
                    <SelectItem value="semana">Semana</SelectItem>
                    <SelectItem value="mes">Mes</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-3">
                  <Button onClick={() => void loadStats()} disabled={statsLoading} className="w-full">
                    Actualizar tablero
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <MessagesSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none">{stats.total}</p>
              <p className="mt-1 text-xs text-muted-foreground">Mensajes totales</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-accent/10 p-3">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none text-accent">{stats.people}</p>
              <p className="mt-1 text-xs text-muted-foreground">Usuarios unicos sumados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-success/10 p-3">
              <UserPlus className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none text-success">{stats.newPeople}</p>
              <p className="mt-1 text-xs text-muted-foreground">Usuarios nuevos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-warning/10 p-3">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none text-warning">{stats.returning}</p>
              <p className="mt-1 text-xs text-muted-foreground">Usuarios recurrentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {statsError && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-destructive">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p>{statsError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Actividad por periodo</span>
              <Badge variant="outline">{periods.length} periodos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : periods.length === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <MessagesSquare className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Sin datos para el rango seleccionado</p>
                <p className="text-sm text-muted-foreground">
                  Ajuste fechas o filtros para consultar actividad.
                </p>
              </div>
            ) : (
              <ChartContainer config={PERIOD_CHART_CONFIG} className="h-[260px] w-full">
                <BarChart accessibilityLayer data={periodChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="periodo" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="usuarios" fill="var(--color-usuarios)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribucion por opcion</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : optionsChartData.length === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <Filter className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No hay opciones registradas</p>
                <p className="text-sm text-muted-foreground">
                  Cuando el rango tenga datos se mostrara la distribucion agregada.
                </p>
              </div>
            ) : (
              <ChartContainer config={OPTION_CHART_CONFIG} className="h-[260px] w-full">
                <BarChart accessibilityLayer data={optionsChartData} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={170} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {statsLoading && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Actualizando estadisticas</span>
        </div>
      )}
    </div>
  );
}
