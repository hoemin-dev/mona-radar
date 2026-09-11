export const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
export function safeUrl(value: unknown): string {
  try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
export const number = (value: unknown): string => value == null || value === "" ? "—" : Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
export const won = (value: unknown): string => value == null || value === "" ? "—" : `${number(value)}원`;
export const date = (value: unknown): string => value ? String(value).replace("T", " ").slice(0, 16) : "—";
export const localTime = (value: unknown): string => value ? new Date(String(value)).toLocaleString("ko-KR", { month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Seoul" }) : "—";
export type Row = Record<string, unknown>;
export interface SearchResult { rows: Row[]; total: number | null; page: number; pageSize?: number; totalPages: number; hasMore?: boolean; limit?: number; countKind?: string; }
export async function api<T>(path: string, signal?: AbortSignal, payload?: unknown): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
  const response = await fetch(base + path, { signal, ...(payload === undefined ? {} : { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API 요청 실패 (${response.status})`);
  return data as T;
}
export function table(data: Row[], columns: [string, string, ((v: unknown, row: Row) => string)?][], identity?: (row: Row) => string): string {
  if (!data.length) return '<div class="empty"><b>검색 결과가 없습니다.</b><span>검색어나 필터를 확인하세요.</span></div>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map(([, label]) => `<th scope="col">${esc(label)}</th>`).join("")}</tr></thead><tbody>${data.map(row => `<tr>${columns.map(([key, , format], index) => `<td>${identity && index === 0 ? `<button class="row-link" data-record="${esc(identity(row))}">${format ? format(row[key], row) : esc(row[key] ?? "—")}</button>` : format ? format(row[key], row) : esc(row[key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
