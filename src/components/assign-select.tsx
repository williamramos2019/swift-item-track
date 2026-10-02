import { CONFERENTES, useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { toast } from "sonner";

export function AssignSelect({ order }: { order: Order }) {
  const assign = useStore((s) => s.assign);
  const val = order.baseStatus === "liberado" ? order.conferente ?? "__fila" : "";
  return (
    <select
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      value={val}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        assign(order.id, v === "__fila" ? null : v);
        toast.success(v === "__fila" ? "Liberado para a fila geral" : `Atribuído a ${v}`);
      }}
    >
      <option value="">Distribuir…</option>
      <option value="__fila">Fila geral</option>
      {CONFERENTES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
