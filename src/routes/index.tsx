import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Truck, PackageOpen, PackageCheck, AlertTriangle, FileClock } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useStore, orderStatus } from "@/lib/store";
import { brDate, dt } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => meta("Painel", "Indicadores de pedidos pendentes, recebimentos parciais, concluídos e divergências do almoxarifado."),
  component: Dashboard,
});

function Dashboard() {
  const { orders, receipts, perfil, audit, lastImportId } = useStore();
  if (perfil === "conferente") return <Navigate to="/conferente" />;
  const rows = orders.map((o) => ({ o, s: orderStatus(o, receipts) }));
  const c = (k: string) => rows.filter((r) => r.s === k);
  const week = Date.now() - 7 * 864e5;
  const done = c("total").filter(({ o }) => receipts.some((r) => r.orderId === o.id && +new Date(r.criadoEm) > week));
  const divs = rows.filter((r) => r.s === "divergencia" || (r.o.divergencias.length > 0 && r.s === "em_revisao"));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const late = rows.filter(({ o, s }) => ["aguardando", "parcial", "aprovado"].includes(s) && (brDate(o.dataEntrega) ?? today) < today);

  const cards = [
    { label: "Pendentes de entrega", n: c("aguardando").length + c("aprovado").length, icon: Truck, cls: "text-warning-foreground bg-warning/25" },
    { label: "Recebimentos parciais", n: c("parcial").length, icon: PackageOpen, cls: "text-accent-foreground bg-primary/20" },
    { label: "Concluídos (7 dias)", n: done.length, icon: PackageCheck, cls: "text-success bg-success/15" },
    { label: "Divergências em aberto", n: divs.length, icon: AlertTriangle, cls: "text-destructive bg-destructive/15" },
  ];

  if (!orders.length)
    return (
      <div className="py-20 text-center">
        <FileClock className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Nenhum pedido cadastrado</h1>
        <p className="mt-1 text-muted-foreground">Importe o ZIP da conversa do WhatsApp com os pedidos de compra.</p>
        <Button className="mt-6" asChild><Link to="/importar">Importar ZIP</Link></Button>
      </div>
    );

  return (
    <>
      <PageHeader title="Painel do almoxarifado" subtitle={`${orders.length} pedidos · ${c("em_revisao").length} em revisão`} actions={<Button asChild><Link to="/importar">Importar ZIP</Link></Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-5">
            <div className={`inline-grid h-9 w-9 place-items-center rounded-md ${k.cls}`}><k.icon className="h-5 w-5" /></div>
            <div className="mt-3 text-4xl font-semibold tabular-nums">{k.n}</div>
            <div className="text-sm text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2"><List title={`Novos pedidos da última importação (${orders.filter((o) => lastImportId && o.importId === lastImportId).length})`} rows={rows.filter(({ o }) => lastImportId && o.importId === lastImportId)} /><p className="mt-1 text-xs text-muted-foreground">Pedidos importados anteriormente aparecem em <Link to="/pedidos" className="underline">Pedidos</Link> usando os filtros.</p></div>
        <List title={`Entregas atrasadas (${late.length})`} rows={late} />
        <List title={`Divergências (${divs.length})`} rows={divs} />
        <List title="Recebimentos parciais" rows={c("parcial")} />
        <div>
          <h2 className="mb-2 font-semibold">Atividade recente</h2>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {audit.slice(0, 8).map((a) => <li key={a.id} className="p-3"><span className="text-xs text-muted-foreground">{dt(a.data)}</span> · <b>{a.acao}</b> — {a.detalhe}</li>)}
          </ul>
        </div>
      </div>
    </>
  );
}

function List({ title, rows }: { title: string; rows: { o: import("@/lib/types").Order; s: import("@/lib/types").OrderStatus }[] }) {
  return (
    <div>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <ul className="divide-y rounded-lg border bg-card text-sm">
        {rows.slice(0, 8).map(({ o, s }) => (
          <li key={o.id}>
            <Link to="/pedidos/$id" params={{ id: o.id }} className="flex items-center gap-3 p-3 hover:bg-muted/50">
              <span className="font-mono font-medium">PC {o.numero}</span>
              <span className="flex-1 truncate text-muted-foreground">{o.fornecedor.nome} · {o.destino}</span>
              <span className="text-xs">{o.dataEntrega}</span><StatusBadge status={s} />
            </Link>
          </li>
        ))}
        {!rows.length && <li className="p-4 text-center text-muted-foreground">Nenhum.</li>}
      </ul>
    </div>
  );
}
