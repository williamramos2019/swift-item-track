import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { useStore, orderStatus, balances } from "@/lib/store";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/conferente/")({
  head: () => meta("Recebimento", "Pedidos aguardando conferência e recebimento no almoxarifado."),
  component: Queue,
});

function Queue() {
  const { orders, receipts, perfil, usuario } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"meus" | "fila">("meus");
  const open = orders
    .filter((o) => o.baseStatus === "liberado")
    .map((o) => ({ o, s: orderStatus(o, receipts) }))
    .filter(({ s }) => s !== "total");
  const list = open
    .filter(({ o }) => (perfil === "gestor" ? (tab === "meus" ? o.conferente : !o.conferente) : tab === "meus" ? o.conferente === usuario : !o.conferente))
    .filter(({ o }) => !q || `${o.numero} ${o.fornecedor.nome} ${o.destino}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Recebimento" subtitle={perfil === "gestor" ? "Visão do gestor" : `Conferente: ${usuario}`} />
      <div className="mb-3 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        {(["meus", "fila"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md py-2 font-medium ${tab === t ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            {t === "meus" ? (perfil === "gestor" ? "Atribuídos" : "Meus pedidos") : "Fila geral"}
          </button>
        ))}
      </div>
      <div className="relative mb-4"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Buscar nº, fornecedor ou destino" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="space-y-2">
        {list.map(({ o, s }) => {
          const pend = balances(o, receipts).filter((i) => i.saldo > 0).length;
          return (
            <Link key={o.id} to="/conferente/$id" params={{ id: o.id }} className="flex items-center gap-3 rounded-lg border bg-card p-4 active:bg-muted">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-lg font-semibold">PC {o.numero}</span><StatusBadge status={s} /></div>
                <div className="truncate text-sm">{o.fornecedor.nome}</div>
                <div className="text-xs text-muted-foreground">{o.destino} · entrega {o.dataEntrega} · {pend} item(ns) pendente(s){perfil === "gestor" && o.conferente ? ` · ${o.conferente}` : ""}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}
        {!list.length && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido aguardando recebimento.</p>}
      </div>
    </div>
  );
}
