import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es });
  } catch {
    return "";
  }
}

const nf = new Intl.NumberFormat("es-VE");
export function formatNumber(n: number): string {
  return nf.format(n);
}
