import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfWeek, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CalendarDays, Loader2, MessageCircle, Phone, RefreshCw, Search, Users } from "lucide-react";

import DateNavigator from "@/components/DateNavigator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildDateParam,
  DateMode,
  formatConversationDate,
  formatLastMessageDate,
  formatPathType,
  getConversationText,
  isOutbound,
} from "@/lib/bot-dashboard";
import {
  BotConversationMessage,
  BotStatsUser,
  fetchBotConversation,
  fetchBotUsers,
  formatBotPhone,
  normalizeBotPhone,
} from "@/lib/bot-messages";

export default function MensajesBot() {
  const [fromDate, setFromDate] = useState<Date>(startOfWeek(new Date(), { locale: es }));
  const [toDate, setToDate] = useState<Date>(endOfWeek(new Date(), { locale: es }));
  const [dateMode, setDateMode] = useState<DateMode>("semana");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [users, setUsers] = useState<BotStatsUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [appliedPhoneFilter, setAppliedPhoneFilter] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<BotConversationMessage[]>([]);

  const fromDateParam = useMemo(() => buildDateParam(fromDate), [fromDate]);
  const toDateParam = useMemo(() => buildDateParam(toDate), [toDate]);
  const normalizedPhoneInput = useMemo(() => normalizeBotPhone(phoneInput), [phoneInput]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const response = await fetchBotUsers({
        desde: fromDateParam,
        hasta: toDateParam,
        telefono: appliedPhoneFilter || undefined,
      });

      const nextUsers = response.usuarios ?? [];
      setUsers(nextUsers);
      setSelectedPhone((currentSelectedPhone) => {
        if (currentSelectedPhone && nextUsers.some((user) => user.telefono === currentSelectedPhone)) {
          return currentSelectedPhone;
        }

        if (appliedPhoneFilter) {
          return appliedPhoneFilter;
        }

        return nextUsers[0]?.telefono ?? null;
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "No se pudieron cargar los telefonos";
      setUsersError(message);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [appliedPhoneFilter, fromDateParam, toDateParam]);

  const loadConversation = useCallback(async () => {
    if (!selectedPhone) {
      setMessages([]);
      setConversationError(null);
      return;
    }

    setConversationLoading(true);
    setConversationError(null);

    try {
      const response = await fetchBotConversation(selectedPhone, fromDateParam, toDateParam);
      setMessages(response.conversacion);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "No se pudo cargar la conversacion";
      setConversationError(message);
      setMessages([]);
    } finally {
      setConversationLoading(false);
    }
  }, [fromDateParam, selectedPhone, toDateParam]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  const handleDateRangeChange = useCallback((from: Date, to: Date) => {
    setFromDate(from);
    setToDate(to);
  }, []);

  const applyFilters = useCallback(() => {
    setAppliedPhoneFilter(normalizedPhoneInput);
  }, [normalizedPhoneInput]);

  const clearFilters = useCallback(() => {
    setPhoneInput("");
    setAppliedPhoneFilter("");
    setSelectedPhone(null);
    setMessages([]);
    setConversationError(null);
  }, []);

  const openConversation = useCallback(() => {
    const phoneToOpen = normalizedPhoneInput || appliedPhoneFilter;
    setSelectedPhone(phoneToOpen || null);
  }, [appliedPhoneFilter, normalizedPhoneInput]);

  const selectedUser = useMemo(
    () => users.find((user) => user.telefono === selectedPhone) ?? null,
    [selectedPhone, users],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mensajes Bot</h1>
          <p className="text-muted-foreground">
            Lista de conversaciones y visor del historial almacenado por telefono.
          </p>
        </div>
        <Button onClick={() => void Promise.all([loadUsers(), loadConversation()])} disabled={usersLoading || conversationLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${(usersLoading || conversationLoading) ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="grid items-start gap-5 bg-[linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.18))] p-5 xl:grid-cols-[minmax(0,1.2fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background/95 p-5 shadow-sm">
              <DateNavigator
                mode={dateMode}
                setMode={setDateMode}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rango consultado</p>
                <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    {fromDateParam} a {toDateParam}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filtro telefono</p>
                <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                  <Phone className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{appliedPhoneFilter || "Todos los telefonos"}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seleccion actual</p>
                <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                  <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{selectedPhone ? formatBotPhone(selectedPhone) : "Sin conversacion abierta"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Busqueda de conversaciones</p>
              <p className="text-xs text-muted-foreground">
                Filtra la lista por telefono o abre directamente una conversacion especifica.
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Telefono</p>
              <Input
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="3102402816"
                inputMode="numeric"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={applyFilters} className="flex-1 sm:flex-none">
                <Search className="mr-2 h-4 w-4" />
                Filtrar lista
              </Button>
              <Button
                variant="outline"
                onClick={openConversation}
                disabled={!normalizedPhoneInput && !appliedPhoneFilter}
                className="flex-1 sm:flex-none"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Abrir conversacion
              </Button>
              <Button variant="ghost" onClick={clearFilters}>
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(usersError || conversationError) && (
        <Card className="border-destructive/40">
          <CardContent className="space-y-2 py-4 text-destructive">
            {usersError && (
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <p>{usersError}</p>
              </div>
            )}
            {conversationError && (
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <p>{conversationError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="min-h-[620px]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Telefonos</span>
              <Badge variant="outline">{users.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[700px] space-y-3 overflow-y-auto pr-2">
            {usersLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border p-4">
                  <Skeleton className="mb-2 h-5 w-32" />
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : users.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Sin telefonos</p>
                <p className="text-sm text-muted-foreground">
                  No hay usuarios con actividad para el rango seleccionado.
                </p>
              </div>
            ) : (
              users.map((user) => {
                const active = user.telefono === selectedPhone;
                return (
                  <button
                    key={user.telefono}
                    type="button"
                    onClick={() => {
                      setSelectedPhone(user.telefono);
                      setPhoneInput(formatBotPhone(user.telefono));
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate font-semibold">{formatBotPhone(user.telefono)}</span>
                      </div>
                    </div>
                    <div className="mb-2 text-xs text-muted-foreground">{formatPathType(user.path_type)}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Ultima actividad</span>
                      <span>{formatLastMessageDate(user.ultimo_mensaje)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[620px] overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex flex-col gap-3 text-base lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">
                  {selectedPhone ? formatBotPhone(selectedPhone) : "Seleccione un telefono"}
                </p>
                <p className="text-sm font-normal text-muted-foreground">
                  Historial del numero seleccionado dentro del rango filtrado.
                </p>
              </div>
              {selectedPhone && (
                <div className="flex flex-wrap gap-2">
                  {selectedUser?.path_type && <Badge variant="secondary">{formatPathType(selectedUser.path_type)}</Badge>}
                  <Badge variant="outline">
                    <Phone className="mr-2 h-3.5 w-3.5" />
                    {messages.length} mensajes
                  </Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[620px] flex-col gap-4 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.06),_transparent_40%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.2))] p-5">
            {!selectedPhone ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <MessageCircle className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="font-medium">Sin telefono seleccionado</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Seleccione un numero de la lista o escriba uno arriba para abrir la conversacion.
                </p>
              </div>
            ) : conversationLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <Skeleton className="h-20 w-[70%] rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Sin mensajes para este telefono</p>
                <p className="text-sm text-muted-foreground">
                  No hay registros en la base de datos dentro del rango actual.
                </p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.map((message, index) => {
                  const outbound = isOutbound(message.direccion);
                  return (
                    <div
                      key={`${message.fecha}-${message.direccion}-${index}`}
                      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                          outbound
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-card text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">
                          {getConversationText(message)}
                        </p>
                        <div
                          className={`mt-3 flex items-center justify-between gap-3 text-xs ${
                            outbound ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          <span>{formatConversationDate(message.fecha)}</span>
                          <span className="uppercase">{message.tipo}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(usersLoading || conversationLoading) && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Actualizando conversaciones</span>
        </div>
      )}
    </div>
  );
}
