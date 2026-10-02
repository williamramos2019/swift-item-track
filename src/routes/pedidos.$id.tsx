import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Divergences, Totals } from "@/components/order-editor";
import { AssignSelect } from "@/components/assign-select";
import { ReceiptHistory } from "@/components/receipt-history";
import { Button } from "@/components/ui/button";
import { useStore, orderStatus, balances } from "@/lib/store";
import { brl, dt, num } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/pedidos/$id")({
  head: () => meta("Detalhe do pedido", "Dados completos, saldos por item, recebimentos e auditoria do pedido."),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const s = useStore();
  const o = s.orders.find((x) => x.id === id);
  if (!o) return <p>Pedido não encontrado. <Link to="/pedidos" className="text-primary underline">Voltar</Link></p>;
  const st = orderStatus(o, s.receipts);
  const b = balances(o, s.receipts);
  const gestor = s.perfil === "gestor";

  return (
    <>
      <PageHeader
        title={`PC ${o.numero}${o.revisao ? ` · rev ${o.revisao}` : ""}`}
        subtitle={`${o.fornecedor.nome} · destino ${o.destino || "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={st} />
            {gestor && o.baseStatus === "em_revisao" && <Button size="sm" onClick={() => s.approve(o.id)}>Aprovar</Button>}
            {gestor && o.baseStatus !== "em_revisao" && <AssignSelect order={o} />}
            {gestor && st === "divergencia" && <Button size="sm" variant="outline" onClick={() => s.resolveDivergence(o.id)}>Marcar divergência tratada</Button>}
            {o.baseStatus === "liberado" && st !== "total" && <Button size="sm" asChild><Link to="/conferente/$id" params={{ id: o.id }}>Registrar recebimento</Link></Button>}
          </div>
        }
      />
      {o.pendingRevision && <div className="mb-4 rounded-md border border-info/40 bg-info/10 p-3 text-sm">Revisão {o.pendingRevision.rev} aguardando aprovação. <Link to="/aprovacao" className="underline">Ver fila</Link></div>}
      {o.divergencias.length > 0 && <div className="mb-4"><Divergences list={o.divergencias} /></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Info title="Pedido" rows={[["Emissão", o.dataEmissao], ["Previsão de entrega", o.dataEntrega], ["Comprador", o.comprador], ["Pagamento", o.pagamento], ["Frete", o.frete], ["Finalidade", o.finalidade], ["Arquivo", o.arquivo]]} />
        <Info title="Filial compradora" rows={[["Razão social", o.filial.nome], ["CNPJ", o.filial.cnpj], ["I.E.", o.filial.ie], ["Endereço", `${o.filial.endereco} — ${o.filial.cidade}/${o.filial.uf} ${o.filial.cep}`], ["Fone", o.filial.contato ?? ""]]} />
        <Info title="Fornecedor" rows={[["Razão social", o.fornecedor.nome], ["Código", o.fornecedor.codigo ?? ""], ["CNPJ", o.fornecedor.cnpj], ["I.E.", o.fornecedor.ie], ["Endereço", `${o.fornecedor.endereco}${o.fornecedor.bairro ? `, ${o.fornecedor.bairro}` : ""} — ${o.fornecedor.cidade}/${o.fornecedor.uf} ${o.fornecedor.cep}`], ["Contato", o.fornecedor.contato ?? ""]]} />
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Itens e saldos</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="p-2">#</th><th className="p-2">Código</th><th className="p-2">Descrição</th><th className="p-2">UN</th><th className="p-2 text-right">Pedido</th><th className="p-2 text-right">Aceito</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Vl. unit.</th><th className="p-2 text-right">Total</th><th className="p-2">Entrega</th></tr>
          </thead>
          <tbody>
            {b.map((i) => (
              <tr key={i.seq} className="border-t">
                <td className="p-2">{i.seq}</td><td className="p-2 font-mono text-xs">{i.codigo}</td><td className="p-2">{i.descricao}</td><td className="p-2">{i.un}</td>
                <td className="p-2 text-right">{num(i.qtd)}</td><td className="p-2 text-right">{num(i.aceito)}</td>
                <td className={`p-2 text-right font-semibold ${i.saldo > 0 ? "text-primary" : "text-success"}`}>{num(i.saldo)}</td>
                <td className="p-2 text-right">{brl(i.vlUnit)}</td><td className="p-2 text-right">{brl(i.vlTotal)}</td><td className="p-2">{i.dtEntrega}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="rounded-lg border bg-card p-4 text-sm"><h3 className="mb-1 font-semibold">Observações</h3><p className="whitespace-pre-wrap text-muted-foreground">{o.observacoes || "—"}</p></div>
        <Totals t={o.totais} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div><h2 className="mb-2 font-semibold">Recebimentos</h2><ReceiptHistory order={o} canReverse={gestor} /></div>
        <div>
          <h2 className="mb-2 font-semibold">Revisões e auditoria</h2>
          <ul className="space-y-1 text-sm">
            {o.revisoes.map((r) => <li key={r.rev} className="text-muted-foreground">Revisão {r.rev} · {dt(r.data)} · {r.arquivo}</li>)}
          </ul>
          <ul className="mt-3 space-y-1 border-t pt-3 text-xs">
            {s.audit.filter((a) => a.orderId === o.id).map((a) => <li key={a.id}><span className="text-muted-foreground">{dt(a.data)} · {a.usuario}</span> — <b>{a.acao}</b>: {a.detalhe}</li>)}
          </ul>
          {gestor && <Button className="mt-4" size="sm" variant="ghost" onClick={() => { if (confirm("Excluir este pedido?")) { s.deleteOrder(o.id); nav({ to: "/pedidos" }); } }}>Excluir pedido</Button>}
        </div>
      </div>
    </>
  );
}

function Info({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="space-y-1 text-sm">{rows.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v || "—"}</dd></div>)}</dl>
    </div>
  );
}
