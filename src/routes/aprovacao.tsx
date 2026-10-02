import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderEditor, Divergences } from "@/components/order-editor";
import { AssignSelect } from "@/components/assign-select";
import { useStore } from "@/lib/store";
import type { OrderData } from "@/lib/types";
import { brl } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/aprovacao")({
  head: () => meta("Fila de aprovação", "Revise, aprove e distribua os pedidos importados aos conferentes."),
  component: Approval,
});

function Approval() {
  const s = useStore();
  const novos = s.orders.filter((o) => o.baseStatus === "em_revisao");
  const revs = s.orders.filter((o) => o.pendingRevision);
  const aprovados = s.orders.filter((o) => o.baseStatus === "aprovado");
  const [edit, setEdit] = useState<{ id: string; data: OrderData } | null>(null);

  return (
    <>
      <PageHeader title="Fila de aprovação" subtitle="Pedidos importados aguardando revisão do gestor, revisões e distribuição." />
      <Section title={`Novos pedidos em revisão (${novos.length})`}>
        {novos.map((o) => (
          <Card key={o.id} o={o}>
            <Button size="sm" variant="outline" onClick={() => setEdit({ id: o.id, data: o })}>Editar</Button>
            <Button size="sm" onClick={() => { s.approve(o.id); toast.success(`PC ${o.numero} aprovado`); }}>Aprovar</Button>
          </Card>
        ))}
        {novos.length > 1 && (
          <Button variant="secondary" onClick={() => { novos.filter((o) => !o.divergencias.length).forEach((o) => s.approve(o.id)); toast.success("Pedidos sem divergência aprovados"); }}>
            Aprovar todos sem divergência
          </Button>
        )}
      </Section>
      <Section title={`Revisões de pedidos existentes (${revs.length})`}>
        {revs.map((o) => (
          <div key={o.id} className="rounded-lg border bg-card p-4">
            <div className="mb-2 font-medium">PC {o.numero} · {o.fornecedor.nome} — revisão {o.pendingRevision!.rev}</div>
            <RevDiff a={o} b={o.pendingRevision!.snapshot} />
            <p className="mt-2 text-xs text-muted-foreground">Recebimentos já registrados serão preservados.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => s.approveRevision(o.id)}>Aplicar revisão</Button>
              <Button size="sm" variant="outline" onClick={() => s.rejectRevision(o.id)}>Rejeitar</Button>
            </div>
          </div>
        ))}
      </Section>
      <Section title={`Aprovados aguardando distribuição (${aprovados.length})`}>
        {aprovados.map((o) => (
          <Card key={o.id} o={o}><AssignSelect order={o} /></Card>
        ))}
      </Section>

      <Dialog open={!!edit} onOpenChange={(x) => !x && setEdit(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader><DialogTitle>Editar PC {edit?.data.numero}</DialogTitle></DialogHeader>
          {edit && <OrderEditor value={edit.data} onChange={(data) => setEdit({ ...edit, data })} />}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={() => { const { id, data } = edit!; s.updateOrder(id, { ...data } as never); s.log("Edição", "Dados do pedido revisados", id); setEdit(null); }}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children.flat().filter(Boolean) : [children].filter(Boolean);
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-3">{arr.length ? children : <p className="text-sm text-muted-foreground">Nada pendente.</p>}</div>
    </section>
  );
}

function Card({ o, children }: { o: import("@/lib/types").Order; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/pedidos/$id" params={{ id: o.id }} className="font-mono font-semibold hover:text-primary">PC {o.numero}</Link>
          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">{o.destino || "sem destino"}</span>
          <div className="text-sm">{o.fornecedor.nome}</div>
          <div className="text-xs text-muted-foreground">Emissão {o.dataEmissao} · Entrega {o.dataEntrega} · {o.itens.length} itens · {brl(o.totais.total)}</div>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
      {o.divergencias.length > 0 && <div className="mt-3"><Divergences list={o.divergencias} /></div>}
    </div>
  );
}

function RevDiff({ a, b }: { a: OrderData; b: OrderData }) {
  const rows: [string, string, string][] = [
    ["Entrega", a.dataEntrega, b.dataEntrega],
    ["Total", brl(a.totais.total), brl(b.totais.total)],
    ["Itens", String(a.itens.length), String(b.itens.length)],
  ];
  b.itens.forEach((i) => {
    const o = a.itens.find((x) => x.codigo === i.codigo);
    if (!o) rows.push([`+ ${i.codigo}`, "—", `${i.qtd} ${i.un}`]);
    else if (o.qtd !== i.qtd || o.vlUnit !== i.vlUnit) rows.push([i.codigo, `${o.qtd} × ${brl(o.vlUnit)}`, `${i.qtd} × ${brl(i.vlUnit)}`]);
  });
  a.itens.filter((i) => !b.itens.some((x) => x.codigo === i.codigo)).forEach((i) => rows.push([`− ${i.codigo}`, `${i.qtd} ${i.un}`, "removido"]));
  return (
    <table className="text-sm">
      <thead className="text-xs text-muted-foreground"><tr><th className="pr-6 text-left">Campo</th><th className="pr-6 text-left">Atual</th><th className="text-left">Nova</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r[0]} className={r[1] !== r[2] ? "font-medium" : "text-muted-foreground"}><td className="pr-6">{r[0]}</td><td className="pr-6">{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
    </table>
  );
}
