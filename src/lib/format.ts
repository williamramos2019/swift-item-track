export const brl = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
export const parseBr = (s: string) => {
  if (!s) return 0;
  const v = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(v) ? 0 : v;
};
/** dd/mm/aaaa -> Date */
export const brDate = (s: string): Date | null => {
  const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
};
export const toIso = (s: string) => {
  const d = brDate(s);
  return d ? d.toISOString().slice(0, 10) : "";
};
export const fromIso = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};
export const dt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
