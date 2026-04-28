const DAGUAS_STATS_URL = "https://paneln8n.cosasinteligentes.co/webhook/daguas-stats";
const DAGUAS_API_KEY = "e78a2e3c14cabcc26f52776f7683b59a25b3aabd6fc6db9351380fba55ee8e14";

export type BotStatsGrouping = "dia" | "semana" | "mes";

export interface BotStatsPeriod {
  periodo: string;
  total: number;
  opciones: Record<string, number>;
  usuarios_unicos: number;
  nuevos: number;
  recurrentes: number;
}

export interface BotStatsUser {
  telefono: string;
  mensajes: number;
  ultimo_mensaje: string | null;
  path_type?: string | null;
}

export interface BotStatsResponse {
  error: string | null;
  periodos: BotStatsPeriod[];
}

export interface BotUsersResponse {
  error: string | null;
  usuarios: BotStatsUser[];
}

export interface BotConversationMessage {
  fecha: string;
  direccion: "inbound" | "outbound" | "outbound-api" | string;
  contenido: string;
  tipo: string;
}

export interface BotConversationResponse {
  error: string | null;
  conversacion: BotConversationMessage[];
}

interface BotStatsFilters {
  desde: string;
  hasta: string;
  agrupacion: BotStatsGrouping;
  opcion?: string;
  telefono?: string;
}

async function fetchWebhook<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(DAGUAS_STATS_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Key": DAGUAS_API_KEY,
    },
  });

  if (!response.ok) {
    let errorMessage = `Error ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) errorMessage = body.error;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as T & { error?: string | null };
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export function normalizeBotPhone(phoneNumber: string): string {
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  if (digitsOnly.length === 12 && digitsOnly.startsWith("57")) {
    return digitsOnly.slice(2);
  }
  return digitsOnly;
}

export function formatBotPhone(phoneNumber: string): string {
  return normalizeBotPhone(phoneNumber);
}

export async function fetchBotStats(filters: BotStatsFilters): Promise<BotStatsResponse> {
  return fetchWebhook<BotStatsResponse>({
    accion: "estadisticas",
    desde: filters.desde,
    hasta: filters.hasta,
    agrupacion: filters.agrupacion,
    ...(filters.opcion ? { opcion: filters.opcion } : {}),
    ...(filters.telefono ? { telefono: filters.telefono } : {}),
  });
}

export async function fetchBotUsers(filters: Pick<BotStatsFilters, "desde" | "hasta" | "telefono">): Promise<BotUsersResponse> {
  return fetchWebhook<BotUsersResponse>({
    accion: "usuarios",
    desde: filters.desde,
    hasta: filters.hasta,
    ...(filters.telefono ? { telefono: filters.telefono } : {}),
  });
}

export async function fetchBotConversation(
  phoneNumber: string,
  fromDate: string,
  toDate: string,
): Promise<BotConversationResponse> {
  const telefono = normalizeBotPhone(phoneNumber);
  if (!telefono) {
    return { error: null, conversacion: [] };
  }

  return fetchWebhook<BotConversationResponse>({
    accion: "conversacion",
    telefono,
    desde: fromDate,
    hasta: toDate,
  });
}
