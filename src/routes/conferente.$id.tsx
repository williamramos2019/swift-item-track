import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { ReceiptHistory } from "@/components/receipt-history";
import { useStore, orderStatus, balances } from "@/lib/store";
import type { Ocorrencia, ReceiptLine } from "@/lib/types";
import { num, uid } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/conferente/$id")({
  head: () => meta("Conferência do pedido", "Registro de entrega, conferência item a item e ocorrências."),
  component: Conference,
});

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function Conference() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const s = useStore();
  const o = s.orders.find((x) => x.id === id);
  const [dataHora, setDataHora] = useState(nowLocal());
  const [nf, setNf] = useState("");
  const [resp, setResp] = useState("");
  const [obs, setObs] = useState("");
  const [autoriza, setAutoriza] = useState(false);
  const [lines, setLines] = useState<Record<number, ReceiptLine>>({});
  if (!o) return <p>Pedido não encontrado.</p>;
  const b = balances(o, s.receipts);
  const st = orderStatus(o, s.receipts);
  const L = (seq: number): ReceiptLine => lines[seq] ?? { seq, apresentada: 0, aceita: 0, recusada: 0, ocorrencia: "", obs: "" };
  const upd = (seq: number, p: Partial<ReceiptLine>) => {
    const n = { ...L(seq), ...p };
    if ("apresentada" in p || "aceita" in p) n.recusada = Math.max(0, +(n.apresentada - n.aceita).toFixed(4));
    setLines({ ...lines, [seq]: n });
  };
  const excess = b.filter((i) => L(i.seq).aceita > i.saldo);

  function save(): void {
    const ls = b.map((i) => L(i.seq)).filter((l) => l.apresentada || l.aceita || l.ocorrencia);
    if (!nf.trim()) { toast.error("Informe o número da NF do fornecedor."); return; }
    if (!resp.trim()) { toast.error("Informe o responsável pela entrega."); return; }
    if (!ls.length) { toast.error("Informe ao menos um item conferido."); return; }
    for (const l of ls) {
      if (l.aceita > l.apresentada) { toast.error("Quantidade aceita não pode ser maior que a apresentada."); return; }
      if (l.aceita < 0 || l.apresentada < 0) { toast.error("Quantidades inválidas."); return; }
      if (l.recusada > 0 && !l.ocorrencia) { toast.error("Informe o tipo de ocorrência para itens recusados."); return; }
    }
    if (excess.length && !(s.perfil === "gestor" && autoriza))
      { toast.error("Quantidade aceita acima do saldo pedido. Requer autorização do gestor."); return; }
    s.addReceipt({
      id: uid(), orderId: o!.id, dataHora: new Date(dataHora).toISOString(), nf: nf.trim(), responsavel: resp.trim(), conferente: s.usuario,
      linhas: ls, obs: obs.trim(), excessoAutorizadoPor: excess.length ? s.usuario : undefined, estornado: false, criadoEm: new Date().toISOString(),
    });
    toast.success("Recebimento registrado");
    nav({ to: "/conferente" });
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <Link to="/conferente" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between"><span className="font-mono text-xl font-semibold">PC {o.numero}</span><StatusBadge status={st} /></div>
        <div className="font-medium">{o.fornecedor.nome}</div>
        <div className="text-xs text-muted-foreground">CNPJ {o.fornecedor.cnpj} · destino <b>{o.destino}</b> · previsão {o.dataEntrega}</div>
        {o.observacoes && <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs">{o.observacoes}</p>}
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3 rounded-lg border bg-card p-4">
        <label className="col-span-2 text-sm">Data/hora da entrega<Input type="datetime-local" className="mt-1 h-11" value={dataHora} onChange={(e) => setDataHora(e.target.value)} /></label>
        <label className="text-sm">NF do fornecedor<Input inputMode="numeric" className="mt-1 h-11" value={nf} onChange={(e) => setNf(e.target.value)} /></label>
        <label className="text-sm">Responsável / motorista<Input className="mt-1 h-11" value={resp} onChange={(e) => setResp(e.target.value)} /></label>
      </section>

      <h2 className="mb-2 font-semibold">Itens</h2>
      <div className="space-y-3">
        {b.map((i) => {
          const l = L(i.seq);
          const over = l.aceita > i.saldo;
          return (
            <div key={i.seq} className={`rounded-lg border bg-card p-4 ${over ? "border-destructive" : ""}`}>
              <div className="flex justify-between gap-2 text-xs"><span className="font-mono font-semibold">{i.seq}. {i.codigo}</span><span>Pedido {num(i.qtd)} {i.un}</span></div>
              <p className="my-1 text-sm">{i.descricao}</p>
              <div className={`mb-3 text-sm font-semibold ${i.saldo > 0 ? "text-primary" : "text-success"}`}>Saldo pendente: {num(i.saldo)} {i.un}</div>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Apresentada" v={l.apresentada} on={(v) => upd(i.seq, { apresentada: v, aceita: l.aceita || Math.min(v, i.saldo) })} />
                <NumField label="Aceita" v={l.aceita} on={(v) => upd(i.seq, { aceita: v })} />
                <NumField label="Recusada" v={l.recusada} on={(v) => upd(i.seq, { recusada: v })} />
              </div>
              {over && <p className="mt-2 text-xs text-destructive">Acima do saldo pedido — requer autorização do gestor.</p>}
              <div className="mt-2 grid grid-cols-[130px_1fr] gap-2">
                <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={l.ocorrencia} onChange={(e) => upd(i.seq, { ocorrencia: e.target.value as Ocorrencia })}>
                  <option value="">Sem ocorrência</option><option value="falta">Falta</option><option value="avaria">Avaria</option><option value="incorreto">Item incorreto</option><option value="outro">Outro</option>
                </select>
                {l.ocorrencia && <Input className="h-10" placeholder="Detalhe a ocorrência" value={l.obs} onChange={(e) => upd(i.seq, { obs: e.target.value })} />}
              </div>
            </div>
          );
        })}
      </div>

      <label className="mt-4 block text-sm">Observações gerais<Textarea className="mt-1" value={obs} onChange={(e) => setObs(e.target.value)} /></label>
      {excess.length > 0 && s.perfil === "gestor" && (
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} />Autorizo o recebimento acima do saldo pedido</label>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card p-3 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
        <Button className="h-12 w-full text-base" onClick={save}>Registrar recebimento</Button>
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Recebimentos anteriores</h2>
      <ReceiptHistory order={o} canReverse={s.perfil === "gestor"} />
    </div>
  );
}

function NumField({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <label className="text-xs text-muted-foreground">{label}
      <Input type="number" inputMode="decimal" min={0} step="any" className="mt-1 h-11 text-base text-foreground" value={v || ""} onChange={(e) => on(Math.max(0, +e.target.value || 0))} />
    </label>
  );
}
