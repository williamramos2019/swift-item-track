import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { OrderData, OrderItem } from "@/lib/types";
import { detectDivergences } from "@/lib/parser";
import { brl } from "@/lib/format";

function F({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </label>
  );
}

export function Divergences({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="mb-1 flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" /> {list.length} divergência(s) detectada(s)
      </div>
      <ul className="list-disc space-y-0.5 pl-6 text-foreground">
        {list.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}

export function OrderEditor({ value, onChange }: { value: OrderData; onChange: (d: OrderData) => void }) {
  const set = (p: Partial<OrderData>) => onChange({ ...value, ...p });
  const setF = (k: "filial" | "fornecedor", p: object) => set({ [k]: { ...value[k], ...p } } as Partial<OrderData>);
  const setItem = (i: number, p: Partial<OrderItem>) => {
    const itens = value.itens.map((it, j) => {
      if (j !== i) return it;
      const n = { ...it, ...p };
      if ("qtd" in p || "vlUnit" in p) n.vlTotal = +(n.qtd * n.vlUnit).toFixed(2);
      return n;
    });
    set({ itens, totais: { ...value.totais, produtos: itens.reduce((s, x) => s + x.vlTotal, 0) } });
  };
  const divs = detectDivergences(value);

  return (
    <div className="space-y-5">
      <Divergences list={divs} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <F label="Nº do pedido" value={value.numero} onChange={(v) => set({ numero: v })} />
        <F label="Data de emissão" value={value.dataEmissao} onChange={(v) => set({ dataEmissao: v })} />
        <F label="Previsão de entrega" value={value.dataEntrega} onChange={(v) => set({ dataEntrega: v })} />
        <F label="Destino / equipamento" value={value.destino} onChange={(v) => set({ destino: v.toUpperCase() })} />
        <F label="Comprador" value={value.comprador} onChange={(v) => set({ comprador: v })} />
        <F label="Condição de pagamento" value={value.pagamento} onChange={(v) => set({ pagamento: v })} />
        <F label="Frete" value={value.frete} onChange={(v) => set({ frete: v })} />
        <F label="Finalidade" value={value.finalidade} onChange={(v) => set({ finalidade: v })} />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {(["filial", "fornecedor"] as const).map((k) => (
          <section key={k} className="rounded-md border p-3">
            <h4 className="mb-2 text-sm font-semibold">{k === "filial" ? "Empresa / Filial compradora" : "Fornecedor"}</h4>
            <div className="grid grid-cols-2 gap-2">
              <F className="col-span-2" label="Razão social" value={value[k].nome} onChange={(v) => setF(k, { nome: v })} />
              <F label="CNPJ" value={value[k].cnpj} onChange={(v) => setF(k, { cnpj: v })} />
              <F label="I.E." value={value[k].ie} onChange={(v) => setF(k, { ie: v })} />
              <F className="col-span-2" label="Endereço" value={value[k].endereco} onChange={(v) => setF(k, { endereco: v })} />
              <F label="Cidade" value={value[k].cidade} onChange={(v) => setF(k, { cidade: v })} />
              <F label="UF / CEP" value={`${value[k].uf} ${value[k].cep}`.trim()} onChange={(v) => { const [uf, ...c] = v.split(" "); setF(k, { uf, cep: c.join(" ") }); }} />
              <F className="col-span-2" label="Contato" value={value[k].contato ?? ""} onChange={(v) => setF(k, { contato: v })} />
            </div>
          </section>
        ))}
      </div>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Itens ({value.itens.length})</h4>
          <Button size="sm" variant="outline" onClick={() => set({ itens: [...value.itens, { seq: value.itens.length + 1, codigo: "", descricao: "", un: "UN", qtd: 1, vlUnit: 0, ipi: 0, icms: 0, st: 0, desconto: 0, vlTotal: 0, dtEntrega: value.dataEntrega }] })}>
            <Plus className="mr-1 h-4 w-4" /> Item
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">#</th><th className="p-2">Código</th><th className="p-2">Descrição</th><th className="p-2">UN</th>
                <th className="p-2">Qtd</th><th className="p-2">Vl. unit.</th><th className="p-2">Total</th><th className="p-2">Entrega</th><th />
              </tr>
            </thead>
            <tbody>
              {value.itens.map((it, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2 text-muted-foreground">{it.seq}</td>
                  <td className="p-1"><Input className="h-8 w-28 font-mono text-xs" value={it.codigo} onChange={(e) => setItem(i, { codigo: e.target.value })} /></td>
                  <td className="p-1"><Textarea rows={1} className="min-h-8 text-xs" value={it.descricao} onChange={(e) => setItem(i, { descricao: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 w-14" value={it.un} onChange={(e) => setItem(i, { un: e.target.value })} /></td>
                  <td className="p-1"><Input type="number" className="h-8 w-20" value={it.qtd} onChange={(e) => setItem(i, { qtd: +e.target.value })} /></td>
                  <td className="p-1"><Input type="number" step="0.01" className="h-8 w-24" value={it.vlUnit} onChange={(e) => setItem(i, { vlUnit: +e.target.value })} /></td>
                  <td className="whitespace-nowrap p-2">{brl(it.vlTotal)}</td>
                  <td className="p-1"><Input className="h-8 w-28" value={it.dtEntrega} onChange={(e) => setItem(i, { dtEntrega: e.target.value })} /></td>
                  <td className="p-1">
                    <Button size="icon" variant="ghost" onClick={() => set({ itens: value.itens.filter((_, j) => j !== i).map((x, j) => ({ ...x, seq: j + 1 })) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <label>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Observações do pedido</span>
          <Textarea rows={5} value={value.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
        </label>
        <Totals t={value.totais} />
      </div>
    </div>
  );
}

export function Totals({ t }: { t: OrderData["totais"] }) {
  const rows: [string, number][] = [
    ["Produtos", t.produtos], ["Despesas", t.despesas], ["Descontos", -t.desconto],
    ["IPI", t.ipi], ["ICMS", t.icms], ["ST", t.st],
  ];
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between py-0.5"><span className="text-muted-foreground">{l}</span><span>{brl(v)}</span></div>
      ))}
      <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{brl(t.total)}</span></div>
    </div>
  );
}
