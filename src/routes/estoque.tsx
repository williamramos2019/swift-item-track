import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, stockBalances } from "@/lib/store";
import { MOV_LABEL, type MovTipo } from "@/lib/types";
import { dt } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/estoque")({
  head: () => meta("Estoque", "Saldo de estoque do almoxarifado com entradas, saídas, devoluções e perdas."),
  component: Estoque,
});

const TIPO_CLS: Record<MovTipo, string> = {
  entrada: "bg-success/15 text-success",
  devolucao: "bg-info/15 text-info",
  saida: "bg-warning/25 text-warning-foreground",
  perda: "bg-destructive/15 text-destructive",
};

function Estoque() {
  const { estoque, addMove } = useStore();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ tipo: "saida" as MovTipo, codigo: "", qtd: "", origem: "", obs: "" });
  const saldos = useMemo(() => stockBalances(estoque), [estoque]);
  const filt = saldos.filter((s) => !q || (s.codigo + s.descricao).toLowerCase().includes(q.toLowerCase()));
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  function salvar() {
    const item = saldos.find((s) => s.codigo === f.codigo);
    const qtd = Number(f.qtd.replace(",", "."));
    if (!item) return toast.error("Selecione um item do estoque");
    if (!(qtd > 0)) return toast.error("Informe a quantidade");
    if ((f.tipo === "saida" || f.tipo === "perda") && qtd > item.saldo) return toast.error(`Saldo insuficiente (${item.saldo} ${item.un})`);
    if (!f.origem.trim()) return toast.error("Informe destino/motivo");
    addMove({ tipo: f.tipo, codigo: item.codigo, descricao: item.descricao, un: item.un, qtd, origem: f.origem, obs: f.obs });
    setF({ ...f, qtd: "", origem: "", obs: "" });
    toast.success("Movimentação registrada");
    return undefined;
  }

  return (
    <>
      <PageHeader title="Estoque" subtitle={`${saldos.length} itens · entradas automáticas a cada recebimento conferido`} />
      <div className="mb-6 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <select className={sel} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as MovTipo })}>
          {(["saida", "devolucao", "perda", "entrada"] as MovTipo[]).map((t) => <option key={t} value={t}>{MOV_LABEL[t]}</option>)}
        </select>
        <select className={`${sel} lg:col-span-2`} value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })}>
          <option value="">Item…</option>
          {saldos.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.descricao.slice(0, 50)} ({s.saldo} {s.un})</option>)}
        </select>
        <Input placeholder="Quantidade" inputMode="decimal" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
        <Input placeholder="Destino / motivo" value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} />
        <Button onClick={salvar}>Registrar</Button>
        <Input className="sm:col-span-2 lg:col-span-6" placeholder="Observação (opcional)" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Saldos</h2>
        <Input className="max-w-xs" placeholder="Buscar código ou descrição" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-8 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Código</th><th className="p-3">Descrição</th><th className="p-3 text-right">Entradas</th><th className="p-3 text-right">Devoluções</th><th className="p-3 text-right">Saídas</th><th className="p-3 text-right">Perdas</th><th className="p-3 text-right">Saldo</th></tr>
          </thead>
          <tbody>
            {filt.map((s) => (
              <tr key={s.codigo} className="border-t">
                <td className="p-3 font-mono">{s.codigo}</td><td className="p-3">{s.descricao}</td>
                <td className="p-3 text-right tabular-nums">{s.entradas}</td><td className="p-3 text-right tabular-nums">{s.devol}</td>
                <td className="p-3 text-right tabular-nums">{s.saidas}</td><td className="p-3 text-right tabular-nums">{s.perdas}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{s.saldo} {s.un}</td>
              </tr>
            ))}
            {!filt.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem itens. Os itens entram aqui quando um recebimento é registrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-semibold">Movimentações</h2>
      <ul className="divide-y rounded-lg border bg-card text-sm">
        {estoque.slice(0, 100).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 p-3">
            <span className={`rounded px-2 py-0.5 text-xs ${TIPO_CLS[m.tipo]}`}>{MOV_LABEL[m.tipo]}</span>
            <span className="font-mono">{m.codigo}</span>
            <span className="tabular-nums font-medium">{m.qtd} {m.un}</span>
            <span className="flex-1 truncate text-muted-foreground">{m.origem}{m.obs && ` · ${m.obs}`}</span>
            <span className="text-xs text-muted-foreground">{dt(m.data)} · {m.usuario}</span>
          </li>
        ))}
        {!estoque.length && <li className="p-4 text-center text-muted-foreground">Nenhuma movimentação.</li>}
      </ul>
    </>
  );
}
