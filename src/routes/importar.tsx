import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { FileArchive, Loader2, CheckCircle2, Copy, GitBranch, Ban, XCircle, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderEditor } from "@/components/order-editor";
import { useStore } from "@/lib/store";
import { detectDivergences, isPurchaseOrder, orderKey, parseOrder, pdfToLines, sameContent, sha256 } from "@/lib/parser";
import type { ImportLog, OrderData } from "@/lib/types";
import { brl, uid } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/importar")({
  head: () => meta("Importar pedidos", "Importe o ZIP do WhatsApp e extraia os pedidos de compra SAP Business One."),
  component: ImportPage,
});

type Draft = { file: string; hash: string; data: OrderData; kind: "novo" | "revisao"; orderId?: string; include: boolean };

function ImportPage() {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [zipName, setZipName] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [skipped, setSkipped] = useState<{ repetidos: string[]; ignorados: string[]; erros: string[] }>({ repetidos: [], ignorados: [], erros: [] });
  const [editing, setEditing] = useState<number | null>(null);
  const [summary, setSummary] = useState<ImportLog | null>(null);

  async function handle(file: File) {
    setBusy(true); setDrafts([]); setSummary(null); setZipName(file.name);
    const rep: string[] = [], ign: string[] = [], err: string[] = [];
    const out: Draft[] = [];
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((f) => !f.dir);
      let n = 0;
      for (const e of entries) {
        n++;
        const name = e.name.split("/").pop()!;
        setProgress(`${n}/${entries.length} · ${name}`);
        if (!/\.pdf$/i.test(name)) { ign.push(name); continue; }
        if (/CNH|CRLV|comprovante/i.test(name)) { ign.push(name); continue; }
        try {
          const bytes = await e.async("uint8array");
          const hash = await sha256(bytes);
          if (store.hashes.includes(hash) || out.some((d) => d.hash === hash)) { rep.push(`${name} (arquivo idêntico)`); continue; }
          const lines = await pdfToLines(bytes);
          if (!lines.length) { if (/^PC\s/i.test(name)) err.push(`${name}: PDF digitalizado sem texto — cadastrar manualmente`); else ign.push(name); continue; }
          if (!isPurchaseOrder(lines)) { ign.push(name); continue; }
          const data = parseOrder(lines, name);
          const key = orderKey(data);
          const existing = store.orders.find((o) => o.key === key);
          const dupInBatch = out.find((d) => orderKey(d.data) === key);
          if (dupInBatch) { if (sameContent(dupInBatch.data, data)) { rep.push(`${name} (PC ${data.numero} repetido)`); continue; } dupInBatch.data = data; continue; }
          if (existing) {
            if (sameContent(existing, data)) { rep.push(`${name} (PC ${data.numero} já cadastrado)`); store.addHash(hash); continue; }
            out.push({ file: name, hash, data, kind: "revisao", orderId: existing.id, include: true });
          } else out.push({ file: name, hash, data, kind: "novo", include: true });
        } catch (x) {
          err.push(`${name}: ${(x as Error).message}`);
        }
      }
    } catch (x) {
      toast.error("Não foi possível abrir o ZIP: " + (x as Error).message);
    }
    out.sort((a, b) => +a.data.numero - +b.data.numero);
    setDrafts(out); setSkipped({ repetidos: rep, ignorados: ign, erros: err }); setBusy(false); setProgress("");
  }

  function confirm() {
    const log: ImportLog = { id: uid(), data: new Date().toISOString(), arquivo: zipName, usuario: store.usuario, novos: [], repetidos: skipped.repetidos, revisoes: [], ignorados: skipped.ignorados, erros: skipped.erros };
    drafts.filter((d) => d.include).forEach((d) => {
      if (d.kind === "novo") { store.addOrder(d.data, d.file, d.hash); log.novos.push(d.data.numero); }
      else { store.addRevision(d.orderId!, d.data, d.file, d.hash); log.revisoes.push(d.data.numero); }
      store.addHash(d.hash);
    });
    store.addImport(log);
    setSummary(log); setDrafts([]);
    toast.success("Importação concluída");
  }

  return (
    <>
      <PageHeader title="Importar pedidos" subtitle="Envie o ZIP exportado da conversa do WhatsApp. Apenas pedidos de compra SAP serão processados." />
      {!drafts.length && !summary && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input bg-card p-12 text-center hover:border-primary">
          {busy ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <FileArchive className="h-10 w-10 text-primary" />}
          <div className="font-medium">{busy ? "Processando arquivos…" : "Clique ou arraste o arquivo .zip aqui"}</div>
          <div className="max-w-md truncate text-xs text-muted-foreground">{busy ? progress : "Conversas .txt, fotos, CNH, CRLV e comprovantes são ignorados automaticamente."}</div>
          <input type="file" accept=".zip" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
        </label>
      )}

      {drafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="text-sm">
              <b>{drafts.filter((d) => d.kind === "novo").length}</b> novos · <b>{drafts.filter((d) => d.kind === "revisao").length}</b> revisões ·{" "}
              {skipped.repetidos.length} repetidos · {skipped.ignorados.length} ignorados · {skipped.erros.length} erros
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDrafts([])}>Cancelar</Button>
              <Button onClick={confirm}>Salvar {drafts.filter((d) => d.include).length} na fila de aprovação</Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr><th className="p-3"></th><th className="p-3">Pedido</th><th className="p-3">Fornecedor</th><th className="p-3">Destino</th><th className="p-3">Emissão / Entrega</th><th className="p-3">Itens</th><th className="p-3">Total</th><th className="p-3">Situação</th><th /></tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => {
                  const div = detectDivergences(d.data);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-3"><input type="checkbox" checked={d.include} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} /></td>
                      <td className="p-3 font-mono font-medium">PC {d.data.numero}</td>
                      <td className="p-3">{d.data.fornecedor.nome}</td>
                      <td className="p-3">{d.data.destino}</td>
                      <td className="p-3 whitespace-nowrap">{d.data.dataEmissao} → {d.data.dataEntrega}</td>
                      <td className="p-3">{d.data.itens.length}</td>
                      <td className="p-3 whitespace-nowrap">{brl(d.data.totais.total)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {d.kind === "revisao" ? <span className="rounded bg-info/15 px-2 py-0.5 text-xs text-info">Nova revisão</span> : <span className="rounded bg-success/15 px-2 py-0.5 text-xs text-success">Novo</span>}
                          {div.length > 0 && <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{div.length} divergência(s)</span>}
                        </div>
                      </td>
                      <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setEditing(i)}><Pencil className="mr-1 h-4 w-4" />Revisar</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SkippedLists s={skipped} />
        </div>
      )}

      {summary && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Sum icon={CheckCircle2} label="Novos cadastrados" n={summary.novos.length} cls="text-success" />
            <Sum icon={GitBranch} label="Revisões detectadas" n={summary.revisoes.length} cls="text-info" />
            <Sum icon={Copy} label="Repetidos ignorados" n={summary.repetidos.length} cls="text-muted-foreground" />
            <Sum icon={XCircle} label="Erros" n={summary.erros.length} cls="text-destructive" />
          </div>
          <SkippedLists s={summary} />
          <div className="flex gap-2">
            <Button asChild><Link to="/aprovacao">Ir para a fila de aprovação</Link></Button>
            <Button variant="outline" onClick={() => setSummary(null)}>Importar outro ZIP</Button>
          </div>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader><DialogTitle>Prévia · PC {editing !== null && drafts[editing]?.data.numero} <span className="text-xs font-normal text-muted-foreground">{editing !== null && drafts[editing]?.file}</span></DialogTitle></DialogHeader>
          {editing !== null && drafts[editing] && (
            <OrderEditor value={drafts[editing].data} onChange={(data) => setDrafts(drafts.map((x, j) => (j === editing ? { ...x, data } : x)))} />
          )}
          <div className="flex justify-end"><Button onClick={() => setEditing(null)}>Concluir revisão</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Sum({ icon: I, label, n, cls }: { icon: typeof Ban; label: string; n: number; cls: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <I className={`h-5 w-5 ${cls}`} />
      <div className="mt-2 text-3xl font-semibold">{n}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function SkippedLists({ s }: { s: { repetidos: string[]; ignorados: string[]; erros: string[] } }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {([["Repetidos", s.repetidos], ["Ignorados (não são pedidos)", s.ignorados], ["Erros", s.erros]] as const).map(([t, l]) => (
        <details key={t} className="rounded-lg border bg-card p-3 text-sm" open={t === "Erros" && l.length > 0}>
          <summary className="cursor-pointer font-medium">{t} ({l.length})</summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">{l.map((x, i) => <li key={i} className="break-all">{x}</li>)}</ul>
        </details>
      ))}
    </div>
  );
}
