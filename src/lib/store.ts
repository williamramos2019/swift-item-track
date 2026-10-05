import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StockMove, Coleta, AuditEntry, ImportLog, Order, OrderData, OrderStatus, Receipt, Revision } from "./types";
import { detectDivergences, orderKey } from "./parser";
import { uid } from "./format";

export type Perfil = "gestor" | "conferente";

export const CONFERENTES = ["Carlos Almeida", "Juliana Rocha", "Marcos Ferreira"];

interface State {
  perfil: Perfil;
  usuario: string;
  orders: Order[];
  receipts: Receipt[];
  imports: ImportLog[];
  audit: AuditEntry[];
  hashes: string[];
  coletas: Record<string, Coleta>;
  lastImportId: string | null;
  estoque: StockMove[];
  addMove: (m: Omit<StockMove, "id" | "data" | "usuario">) => void;
  setColeta: (orderId: string, patch: Partial<Coleta>) => void;
  setPerfil: (p: Perfil, usuario: string) => void;
  log: (acao: string, detalhe: string, orderId?: string) => void;
  addOrder: (d: OrderData, arquivo: string, hash: string, importId?: string) => void;
  setLastImport: (id: string) => void;
  addRevision: (orderId: string, d: OrderData, arquivo: string, hash: string) => void;
  addHash: (h: string) => void;
  addImport: (l: ImportLog) => void;
  updateOrder: (id: string, d: Partial<Order>) => void;
  approve: (id: string) => void;
  approveRevision: (id: string) => void;
  rejectRevision: (id: string) => void;
  assign: (id: string, conferente: string | null) => void;
  addReceipt: (r: Receipt) => void;
  reverseReceipt: (id: string, motivo: string) => void;
  resolveDivergence: (id: string) => void;
  deleteOrder: (id: string) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      perfil: "gestor",
      usuario: "Gestor Almoxarifado",
      orders: [],
      receipts: [],
      imports: [],
      audit: [],
      hashes: [],
      coletas: {},
      lastImportId: null,
      estoque: [],
      setLastImport: (id) => set({ lastImportId: id }),
      addMove: (m) => {
        set((s) => ({ estoque: [{ ...m, id: uid(), data: new Date().toISOString(), usuario: s.usuario }, ...s.estoque] }));
        get().log("Estoque", `${m.tipo} ${m.qtd} ${m.un} ${m.codigo} — ${m.origem}`, m.orderId);
      },
      setColeta: (orderId, patch) =>
        set((s) => ({ coletas: { ...s.coletas, [orderId]: { status: "aguardando", historico: [], ...s.coletas[orderId], ...patch } } })),
      setPerfil: (perfil, usuario) => set({ perfil, usuario }),
      log: (acao, detalhe, orderId) =>
        set((s) => ({
          audit: [{ id: uid(), data: new Date().toISOString(), usuario: s.usuario, acao, detalhe, orderId }, ...s.audit],
        })),
      addHash: (h) => set((s) => ({ hashes: s.hashes.includes(h) ? s.hashes : [...s.hashes, h] })),
      addImport: (l) => set((s) => ({ imports: [l, ...s.imports] })),
      addOrder: (d, arquivo, hash, importId) => {
        const now = new Date().toISOString();
        const id = uid();
        const o: Order = {
          ...d,
          id,
          key: orderKey(d),
          revisao: 0,
          revisoes: [{ rev: 0, data: now, arquivo, hash, snapshot: d }],
          pendingRevision: null,
          baseStatus: "em_revisao",
          conferente: null,
          divergencias: detectDivergences(d),
          divergenciaResolvida: false,
          arquivo,
          hash,
          criadoEm: now,
          importId,
        };
        set((s) => ({ orders: [o, ...s.orders] }));
        get().log("Importação", `Pedido ${d.numero} importado (${arquivo})`, id);
      },
      addRevision: (orderId, d, arquivo, hash) => {
        const o = get().orders.find((x) => x.id === orderId);
        if (!o) return;
        const rev: Revision = { rev: o.revisao + 1, data: new Date().toISOString(), arquivo, hash, snapshot: d };
        get().updateOrder(orderId, { pendingRevision: rev });
        get().log("Revisão detectada", `Pedido ${o.numero}: revisão ${rev.rev} aguardando aprovação`, orderId);
      },
      updateOrder: (id, d) =>
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== id) return o;
            const n = { ...o, ...d };
            n.divergencias = detectDivergences(n);
            return n;
          }),
        })),
      approve: (id) => {
        get().updateOrder(id, { baseStatus: "aprovado", aprovadoEm: new Date().toISOString() });
        get().log("Aprovação", "Pedido aprovado", id);
      },
      approveRevision: (id) => {
        const o = get().orders.find((x) => x.id === id);
        if (!o?.pendingRevision) return;
        const r = o.pendingRevision;
        get().updateOrder(id, {
          ...r.snapshot,
          revisao: r.rev,
          revisoes: [...o.revisoes, r],
          pendingRevision: null,
          arquivo: r.arquivo,
          hash: r.hash,
        });
        get().log("Revisão aprovada", `Revisão ${r.rev} aplicada; recebimentos anteriores preservados`, id);
      },
      rejectRevision: (id) => {
        get().updateOrder(id, { pendingRevision: null });
        get().log("Revisão rejeitada", "Revisão descartada pelo gestor", id);
      },
      assign: (id, conferente) => {
        get().updateOrder(id, { conferente, baseStatus: "liberado" });
        get().log("Distribuição", conferente ? `Atribuído a ${conferente}` : "Liberado para fila geral", id);
      },
      addReceipt: (r) => {
        set((s) => ({ receipts: [r, ...s.receipts] }));
        const o = get().orders.find((x) => x.id === r.orderId);
        r.linhas.filter((l) => l.aceita > 0).forEach((l) => {
          const it = o?.itens.find((i) => i.seq === l.seq);
          get().addMove({ tipo: "entrada", codigo: it?.codigo ?? String(l.seq), descricao: it?.descricao ?? "", un: it?.un ?? "UN", qtd: l.aceita, origem: `Recebimento PC ${o?.numero} · NF ${r.nf}`, orderId: r.orderId, receiptId: r.id, obs: l.obs });
        });
        const hasIssue = r.linhas.some((l) => l.recusada > 0 || l.ocorrencia);
        if (hasIssue) get().updateOrder(r.orderId, { divergenciaResolvida: false });
        get().log("Recebimento", `NF ${r.nf} registrada por ${r.conferente}`, r.orderId);
      },
      reverseReceipt: (id, motivo) => {
        const r = get().receipts.find((x) => x.id === id);
        set((s) => ({
          receipts: s.receipts.map((x) =>
            x.id === id ? { ...x, estornado: true, estornoMotivo: motivo, estornoEm: new Date().toISOString() } : x,
          ),
        }));
        set((s) => ({ estoque: s.estoque.filter((m) => m.receiptId !== id) }));
        get().log("Estorno", `Recebimento NF ${r?.nf} estornado: ${motivo}`, r?.orderId);
      },
      resolveDivergence: (id) => {
        get().updateOrder(id, { divergenciaResolvida: true });
        get().log("Divergência", "Divergência marcada como tratada", id);
      },
      deleteOrder: (id) => {
        const o = get().orders.find((x) => x.id === id);
        set((s) => ({ orders: s.orders.filter((x) => x.id !== id), hashes: s.hashes.filter((h) => !o?.revisoes.some((r) => r.hash === h)) }));
        get().log("Exclusão", `Pedido ${o?.numero} excluído`);
      },
    }),
    { name: "drilling-almox-v1", skipHydration: true },
  ),
);

/** Accepted qty per item seq for an order (non-reversed receipts). */
export function acceptedBySeq(receipts: Receipt[], orderId: string) {
  const m: Record<number, number> = {};
  receipts
    .filter((r) => r.orderId === orderId && !r.estornado)
    .forEach((r) => r.linhas.forEach((l) => (m[l.seq] = (m[l.seq] || 0) + l.aceita)));
  return m;
}

export function balances(o: Order, receipts: Receipt[]) {
  const acc = acceptedBySeq(receipts, o.id);
  return o.itens.map((i) => ({ ...i, aceito: acc[i.seq] || 0, saldo: Math.max(0, i.qtd - (acc[i.seq] || 0)) }));
}

export function orderStatus(o: Order, receipts: Receipt[]): OrderStatus {
  if (o.baseStatus === "em_revisao") return "em_revisao";
  const rs = receipts.filter((r) => r.orderId === o.id && !r.estornado);
  const issue = rs.some((r) => r.linhas.some((l) => l.recusada > 0 || l.ocorrencia));
  if (issue && !o.divergenciaResolvida) return "divergencia";
  const b = balances(o, receipts);
  if (b.length && b.every((i) => i.saldo <= 0)) return "total";
  if (b.some((i) => i.aceito > 0)) return "parcial";
  if (o.baseStatus === "aprovado") return "aprovado";
  return "aguardando";
}

export function stockBalances(moves: StockMove[]) {
  const m: Record<string, { codigo: string; descricao: string; un: string; saldo: number; entradas: number; saidas: number; devol: number; perdas: number }> = {};
  [...moves].reverse().forEach((x) => {
    const r = (m[x.codigo] ||= { codigo: x.codigo, descricao: x.descricao, un: x.un, saldo: 0, entradas: 0, saidas: 0, devol: 0, perdas: 0 });
    if (x.descricao) r.descricao = x.descricao;
    if (x.tipo === "entrada") { r.entradas += x.qtd; r.saldo += x.qtd; }
    if (x.tipo === "devolucao") { r.devol += x.qtd; r.saldo += x.qtd; }
    if (x.tipo === "saida") { r.saidas += x.qtd; r.saldo -= x.qtd; }
    if (x.tipo === "perda") { r.perdas += x.qtd; r.saldo -= x.qtd; }
  });
  return Object.values(m).sort((a, b) => a.codigo.localeCompare(b.codigo));
}
