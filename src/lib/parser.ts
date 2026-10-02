import type { OrderData, OrderItem } from "./types";
import { brDate, parseBr } from "./format";

/** Extract text lines (grouped by Y coordinate) from a PDF using pdf.js (browser only). */
export async function pdfToLines(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
    for (const it of tc.items as any[]) {
      const s = (it.str ?? "").trim();
      if (!s) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) rows.push((row = { y, parts: [] }));
      row.parts.push({ x, s });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) lines.push(r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" "));
  }
  return lines;
}

export function isPurchaseOrder(lines: string[]) {
  const t = lines.join("\n");
  return /PEDIDO DE COMPRA/i.test(t) && /N[ºo°] do documento/i.test(t);
}

const N = "(-?[\\d.]+,\\d{2,4})";
const ITEM_RE = new RegExp(
  `^([A-Z]{2,3}\\d{4,8})\\s+(.+?)\\s+([A-Za-z²³]{1,5})\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}(?:\\s+(\\d{2}\\/\\d{2}\\/\\d{4}))?`,
);

const all = (re: RegExp, t: string) => [...t.matchAll(re)].map((m) => m[1].trim());
const first = (re: RegExp, t: string) => t.match(re)?.[1]?.trim() ?? "";

export function parseOrder(lines: string[], fileName: string): OrderData {
  const text = lines.join("\n");
  const itemIdx = lines.findIndex((l) => /^Item\s+Descri/i.test(l));
  const obsIdx = lines.findIndex((l) => /Observa[çc][õo]es do pedido/i.test(l));
  const head = lines.slice(0, itemIdx > 0 ? itemIdx : lines.length).join("\n");

  const cnpjs = all(/CNPJ:\s*([\d./-]+)/g, head);
  const ies = all(/I\.E\.:\s*(\d*)/g, head);
  const enderecos = all(/Endere[çc]o:\s*(.+?)(?:\s+CEP:|\s+Bairro:|\s+Vendedor|$)/gm, head);
  const ceps = all(/CEP:\s*([\d.-]+)/g, head);
  const cidades = all(/Cidade:\s*(.+?)(?:\s+(?:Estado|Fone|Vendedor|Condi|Finalidade|CEP)\b|$)/gm, head);
  const ufs = all(/Estado:\s*([A-Z]{2})/g, head);
  const fones = all(/Fone:\s*([\d() -]+)/g, head);

  const supLine = head.match(/^(F\d{6,})\s+(.+?)(?:\s+Data de entrega:.*)?$/m);
  const dataEntrega = first(/Data de entrega:\s*(\d{2}\/\d{2}\/\d{4})/, head);
  let dataEmissao = first(/Data do documento:\s*(\d{2}\/\d{2}\/\d{4})/, head);
  if (!dataEmissao) {
    const ds = all(/(\d{2}\/\d{2}\/\d{4})/g, head).filter((d) => d !== dataEntrega);
    dataEmissao = ds[0] ?? "";
  }

  // Items
  const itens: OrderItem[] = [];
  const end = obsIdx > 0 ? obsIdx : lines.length;
  for (let i = itemIdx + 1; i < end && itemIdx >= 0; i++) {
    const l = lines[i];
    const m = l.match(ITEM_RE);
    if (m) {
      itens.push({
        seq: itens.length + 1,
        codigo: m[1],
        descricao: m[2].trim(),
        un: m[3],
        qtd: parseBr(m[4]),
        vlUnit: parseBr(m[5]),
        ipi: parseBr(m[6]),
        icms: parseBr(m[7]),
        st: parseBr(m[8]),
        desconto: parseBr(m[9]),
        vlTotal: parseBr(m[10]),
        dtEntrega: m[11] ?? dataEntrega,
      });
    } else if (
      itens.length &&
      !/^Item\s+Descri|PEDIDO DE COMPRA|P[áa]gina|FILIAL:|SAP Business/i.test(l) &&
      !/\d{2}\/\d{2}\/\d{4}/.test(l)
    ) {
      itens[itens.length - 1].descricao += " " + l.trim();
    }
  }

  // Observations: strip right-column totals
  let observacoes = "";
  if (obsIdx >= 0) {
    const out: string[] = [];
    for (let i = obsIdx; i < lines.length; i++) {
      let l = lines[i];
      if (/Data da aprova|Assinatura|Impresso por SAP/i.test(l)) break;
      l = l
        .replace(/Observa[çc][õo]es do pedido:/i, "")
        .replace(/(Valor dos Produtos|Outras Despesas|Valor Desconto|Valor Total|Total de impostos|IPI|ICMS|ST):\s*R\$\s*[\d.,-]+/gi, "")
        .trim();
      if (l) out.push(l);
    }
    observacoes = out.join("\n");
  }

  const tot = (label: string) => parseBr(first(new RegExp(`${label}:\\s*R\\$\\s*([\\d.,-]+)`, "i"), text));
  const produtos = tot("Valor dos Produtos") || itens.reduce((s, i) => s + i.vlTotal, 0);
  const despesas = tot("Outras Despesas");
  const desconto = tot("Valor Desconto");
  const total = tot("Valor Total") || produtos + despesas - desconto;

  const fromName = fileName.match(/\(([^)]+)\)/)?.[1]?.trim();
  const fromObs = observacoes.match(/\b(MBG-?\s?\d+|SG\s?\d+|CJ\s?\d+|GG-?\d+|DEPOSITO|DEPÓSITO)\b/i)?.[1];
  const freteLine = head.match(/Tipo do Frete:\s*(.*)$/m)?.[1]?.trim();

  return {
    numero: first(/N[ºo°] do documento:\s*([\d.]+)/i, head).replace(/\./g, ""),
    dataEmissao,
    dataEntrega,
    filial: {
      nome: first(/FILIAL:\s*(.+?)(?:\s+P[áa]gina.*)?$/m, head),
      cnpj: cnpjs[0] ?? "",
      ie: ies[0] ?? "",
      endereco: enderecos[0] ?? "",
      cidade: cidades[0] ?? "",
      uf: ufs[0] ?? "",
      cep: ceps[0] ?? "",
      contato: fones[0] ?? "",
    },
    fornecedor: {
      codigo: supLine?.[1] ?? "",
      nome: (supLine?.[2] ?? "").trim(),
      cnpj: cnpjs[1] ?? "",
      ie: ies[1] ?? "",
      endereco: enderecos[1] ?? "",
      bairro: first(/Bairro:\s*(.+?)(?:\s+Cidade:|$)/m, head),
      cidade: cidades[1] ?? "",
      uf: ufs[1] ?? "",
      cep: ceps[1] ?? "",
      contato: fones[1] ?? "",
    },
    comprador: first(/Vendedor \/ Comprador:\s*(.+?)$/m, head),
    pagamento: first(/Condi[çc][õo]es de pagamento:\s*(.+?)$/m, head),
    finalidade: first(/Finalidade:\s*(.+?)$/m, head),
    frete: freteLine && !/^[\d.,]+$/.test(freteLine) ? freteLine : `Valor ${freteLine || "0,00"}`,
    destino: (fromName || fromObs || "").toUpperCase(),
    observacoes,
    itens,
    totais: {
      produtos,
      despesas,
      desconto,
      total,
      ipi: itens.reduce((s, i) => s + i.ipi, 0),
      icms: itens.reduce((s, i) => s + i.icms, 0),
      st: itens.reduce((s, i) => s + i.st, 0),
    },
  };
}

export function detectDivergences(o: OrderData): string[] {
  const out: string[] = [];
  const em = brDate(o.dataEmissao);
  const en = brDate(o.dataEntrega);
  if (!o.numero) out.push("Número do pedido não identificado.");
  if (!o.fornecedor.cnpj) out.push("CNPJ do fornecedor não identificado.");
  if (!o.itens.length) out.push("Nenhum item extraído do PDF.");
  if (em && en && en < em)
    out.push(`Data de entrega (${o.dataEntrega}) anterior à data de emissão (${o.dataEmissao}).`);
  o.itens.forEach((i) => {
    const d = brDate(i.dtEntrega);
    if (em && d && d < em && i.dtEntrega !== o.dataEntrega)
      out.push(`Item ${i.seq} (${i.codigo}): entrega ${i.dtEntrega} anterior à emissão.`);
    if (Math.abs(i.qtd * i.vlUnit - i.vlTotal) > 0.05)
      out.push(`Item ${i.seq} (${i.codigo}): Qtd × Vl. Unit. difere do Vl. Total.`);
  });
  const soma = o.itens.reduce((s, i) => s + i.vlTotal, 0);
  if (o.itens.length && Math.abs(soma - o.totais.produtos) > 0.05)
    out.push("Soma dos itens difere do Valor dos Produtos.");
  const obsDates = [...o.observacoes.matchAll(/\b(DISPON[IÍ]VEL|ENTREGA|PREVIS[ÃA]O)[^\d]{0,15}(\d{2}\/\d{2}(?:\/\d{2,4})?)/gi)];
  obsDates.forEach((m) =>
    out.push(`Observação menciona data "${m[0].trim()}" — confirmar com a previsão de entrega ${o.dataEntrega}.`),
  );
  return out;
}

export async function sha256(bytes: Uint8Array) {
  const h = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const orderKey = (o: OrderData) =>
  `${(o.filial.cnpj || o.filial.nome).replace(/\D/g, "") || o.filial.nome}|${o.fornecedor.cnpj.replace(/\D/g, "") || o.fornecedor.nome}|${o.numero}`;

export const sameContent = (a: OrderData, b: OrderData) => {
  const norm = (o: OrderData) =>
    JSON.stringify({ e: o.dataEntrega, i: o.itens.map((x) => [x.codigo, x.qtd, x.vlUnit, x.dtEntrega]), t: o.totais.total, obs: o.observacoes });
  return norm(a) === norm(b);
};
