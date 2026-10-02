import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { useStore, orderStatus } from "@/lib/store";
import { STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { brDate, brl } from "@/lib/format";
import { meta } from "@/lib/meta";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/pedidos/")({
  head: () => meta("Pedidos", "Consulta global de pedidos de compra com filtros por fornecedor, entrega, destino e status."),
  component: Orders,
});

function Orders() {
  const { orders, receipts } = useStore();
  const [q, setQ] = useState("");
  const [forn, setForn] = useState("");
  const [dest, setDest] = useState("");
  const [st, setSt] = useState<"" | OrderStatus>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const destinos = [...new Set(orders.map((o) => o.destino).filter(Boolean))].sort();
  const rows = useMemo(
    () =>
      orders
        .map((o) => ({ o, s: orderStatus(o, receipts) }))
        .filter(({ o, s }) => {
          const d = brDate(o.dataEntrega);
          return (
            (!q || o.numero.includes(q)) &&
            (!forn || o.fornecedor.nome.toLowerCase().includes(forn.toLowerCase())) &&
            (!dest || o.destino === dest) &&
            (!st || s === st) &&
            (!de || (d && d >= new Date(de + "T00:00"))) &&
            (!ate || (d && d <= new Date(ate + "T23:59")))
          );
        })
        .sort((a, b) => +b.o.numero - +a.o.numero),
    [orders, receipts, q, forn, dest, st, de, ate],
  );

  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <>
      <PageHeader title="Pedidos" subtitle={`${rows.length} de ${orders.length} pedidos`} />
      <div className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input placeholder="Nº do pedido" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input placeholder="Fornecedor" value={forn} onChange={(e) => setForn(e.target.value)} />
        <select className={sel} value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">Todos destinos</option>{destinos.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className={sel} value={st} onChange={(e) => setSt(e.target.value as OrderStatus)}>
          <option value="">Todos status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Input type="date" title="Entrega de" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input type="date" title="Entrega até" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Pedido</th><th className="p-3">Fornecedor</th><th className="p-3">Destino</th><th className="p-3">Entrega</th><th className="p-3">Conferente</th><th className="p-3">Total</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.map(({ o, s }) => (
              <tr key={o.id} className="border-t hover:bg-muted/50">
                <td className="p-3"><Link to="/pedidos/$id" params={{ id: o.id }} className="font-mono font-medium hover:text-primary">PC {o.numero}</Link>{o.revisao > 0 && <span className="ml-1 text-xs text-muted-foreground">rev {o.revisao}</span>}</td>
                <td className="p-3">{o.fornecedor.nome}</td>
                <td className="p-3">{o.destino}</td>
                <td className="p-3">{o.dataEntrega}</td>
                <td className="p-3 text-muted-foreground">{o.baseStatus === "liberado" ? o.conferente ?? "Fila geral" : "—"}</td>
                <td className="p-3 whitespace-nowrap">{brl(o.totais.total)}</td>
                <td className="p-3"><div className="flex items-center gap-1"><StatusBadge status={s} />{(o.divergencias.length > 0 || o.pendingRevision) && <AlertTriangle className="h-4 w-4 text-destructive" />}</div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum pedido. <Link to="/importar" className="text-primary underline">Importe um ZIP</Link>.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
