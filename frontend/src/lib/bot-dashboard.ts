import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import type { BotConversationMessage, BotStatsGrouping } from "@/lib/bot-messages";

export type DateMode = "todo" | "dia" | "semana" | "mes";

export function buildDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatPeriodLabel(periodo: string, agrupacion: BotStatsGrouping): string {
  if (agrupacion === "mes") {
    const [year, month] = periodo.split("-");
    if (!year || !month) {
      return periodo;
    }

    return format(new Date(Number(year), Number(month) - 1, 1), "MMM yyyy", { locale: es });
  }

  return format(parseISO(periodo), "d MMM", { locale: es });
}

export function formatConversationDate(rawDate: string): string {
  return format(new Date(rawDate), "dd MMM yyyy, h:mm a", { locale: es });
}

export function formatLastMessageDate(rawDate: string | null): string {
  if (!rawDate) {
    return "-";
  }

  return format(parseISO(rawDate), "dd MMM yyyy", { locale: es });
}

export function formatOptionLabel(option: string): string {
  return option.trim() ? option.replace(/_/g, " ") : "SIN OPCION";
}

export function formatPathType(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "Sin ruta";
  }

  return value.replace(/_/g, " ");
}

export function getConversationText(message: BotConversationMessage): string {
  if (message.contenido?.trim()) {
    return message.contenido;
  }

  if (message.tipo && message.tipo !== "text") {
    return `[${message.tipo}]`;
  }

  return "Sin contenido";
}

export function isOutbound(direction: string): boolean {
  const normalized = direction.trim().toLowerCase();
  return (
    normalized.startsWith("outbound") ||
    normalized.startsWith("bot") ||
    normalized.startsWith("assistant") ||
    normalized.startsWith("saliente")
  );
}
