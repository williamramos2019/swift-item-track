import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { dt, num } from "@/lib/format";

const OC: Record<string, string> = { falta: "Falta", avaria: "Avaria", incorreto: "Item incorreto", outro: "Outro" };

export function ReceiptHistory({ order, canReverse }: { order: Order; canReverse: boolean }) {
  const { receipts, reverseReceipt } = useStore();
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const list = receipts.filter((r) => r.orderId === order.id);
  if (!list.length) return <p className="text-sm text-muted-foreground">Nenhum recebimento registrado.</p>;
  return (
    <div className="space-y-3">
      {list.map((r) => (
        <div key={r.id} className={`rounded-md border p-3 text-sm ${r.estornado ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap justify-between gap-2">
            <div><b>NF {r.nf}</b> · {dt(r.dataHora)} · conferente {r.conferente} · responsável {r.responsavel}</div>
            {r.estornado && <span className="rounded bg-destructive/15 px-2 text-xs text-destructive">Estornado: {r.estornoMotivo}</span>}
          </div>
          {r.excessoAutorizadoPor && <div className="text-xs text-warning-foreground">Excesso autorizado por {r.excessoAutorizadoPor}</div>}
          <ul className="mt-2 space-y-1 text-xs">
            {r.linhas.filter((l) => l.apresentada || l.aceita || l.recusada || l.ocorrencia).map((l) => {
              const it = order.itens.find((i) => i.seq === l.seq);
              return (
                <li key={l.seq}>
                  <span className="font-mono">{it?.codigo}</span> — apresentada {num(l.apresentada)} · aceita <b>{num(l.aceita)}</b> · recusada {num(l.recusada)}
                  {l.ocorrencia && <span className="ml-1 text-destructive">[{OC[l.ocorrencia]}{l.obs ? `: ${l.obs}` : ""}]</span>}
                </li>
              );
            })}
          </ul>
          {r.obs && <p className="mt-1 text-xs text-muted-foreground">Obs.: {r.obs}</p>}
          {canReverse && !r.estornado && (
            <div className="mt-2 flex gap-2">
              <input className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs" placeholder="Motivo do estorno" value={motivo[r.id] ?? ""} onChange={(e) => setMotivo({ ...motivo, [r.id]: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!motivo[r.id]?.trim()} onClick={() => reverseReceipt(r.id, motivo[r.id].trim())}>Estornar</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
