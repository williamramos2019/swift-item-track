import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Play, CheckCircle2, CircleDashed, Search, LocateFixed, Package, Timer, CalendarCheck, TrendingUp, Clock, Route, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { geocodeEndereco } from "@/lib/geo.functions";
import { ordenarRota, DEPOSITO, type Ponto } from "@/lib/rota";
import { COLETA_LABEL, type ColetaStatus } from "@/lib/types";
import { meta } from "@/lib/meta";
import { cn } from "@/lib/utils";

const RouteMap = lazy(() => import("@/components/route-map"));
const STATUSES = Object.keys(COLETA_LABEL) as ColetaStatus[];
const dataDia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const horaMin = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const duracao = (ini: string, fim: string) => {
  const m = Math.max(0, Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}min` : `${m} min`;
};

export const Route = createFileRoute("/rotas")({
  head: () => meta("Rotas de coleta", "Mapa com os fornecedores dos pedidos e roteirização das coletas a partir do depósito."),
  component: Rotas,
});

function Rotas() {
  const { orders, coletas, setColeta, log } = useStore();
  const geocode = useServerFn(geocodeEndereco);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<ColetaStatus | "todos">("todos");
  const [sel, setSel] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [rotaGeo, setRotaGeo] = useState<[number, number][] | null>(null);
  const [rotaInfo, setRotaInfo] = useState<{ km: number; min: number } | null>(null);
  const running = useRef(false);
  const [fCidade, setFCidade] = useState("");
  const [fDestino, setFDestino] = useState("");
  const [fPeriodo, setFPeriodo] = useState<"todos" | "1" | "7" | "30">("todos");
  const [fAndamento, setFAndamento] = useState(false);

  const rows = useMemo(
    () => orders.map((o) => ({ o, c: coletas[o.id] ?? { status: "aguardando" as ColetaStatus, historico: [] } })),
    [orders, coletas],
  );
  const pendentesGeo = rows.filter((r) => r.c.lat == null && !r.c.geoFalhou);

  const localizar = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setGeoBusy(true);
    for (const { o } of pendentesGeo) {
      const f = o.fornecedor;
      try {
        const r = await geocode({ data: { endereco: f.endereco.slice(0, 300), bairro: (f.bairro ?? "").slice(0, 120), cidade: f.cidade.slice(0, 120), uf: f.uf.slice(0, 4), cep: f.cep.slice(0, 20) } });
        if (r) setColeta(o.id, { lat: r.lat, lng: r.lng, precisao: r.precisao });
        else setColeta(o.id, { geoFalhou: true });
      } catch {
        setColeta(o.id, { geoFalhou: true });
      }
      await new Promise((res) => setTimeout(res, 1100));
    }
    running.current = false;
    setGeoBusy(false);
  }, [pendentesGeo, geocode, setColeta]);

  useEffect(() => {
    if (pendentesGeo.length) void localizar();
  }, [orders.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pontos: Ponto[] = rows
    .filter((r) => r.c.lat != null)
    .map(({ o, c }) => ({ id: o.id, numero: o.numero, empresa: o.fornecedor.nome, status: c.status, lat: c.lat!, lng: c.lng! }));
  const rota = useMemo(() => ordenarRota(pontos.filter((p) => p.status === "rota")), [pontos.map((p) => p.id + p.status).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotaKey = rota.map((p) => p.id).join(",");
  useEffect(() => {
    setRotaGeo(null);
    setRotaInfo(null);
    if (!rota.length) return;
    const pts = [DEPOSITO, ...rota, DEPOSITO];
    const coords = pts.map((p) => `${p.lng},${p.lat}`).join(";");
    const ctl = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        const r = j.routes?.[0];
        if (!r) return;
        setRotaGeo(r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
        setRotaInfo({ km: r.distance / 1000, min: r.duration / 60 });
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [rotaKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cidades = useMemo(() => [...new Set(rows.map((r) => `${r.o.fornecedor.cidade}/${r.o.fornecedor.uf}`))].sort(), [rows]);
  const destinos = useMemo(() => [...new Set(rows.map((r) => r.o.destino).filter(Boolean))].sort(), [rows]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const now = Date.now();
    return rows
      .filter((r) => filtro === "todos" || r.c.status === filtro)
      .filter((r) => !fCidade || `${r.o.fornecedor.cidade}/${r.o.fornecedor.uf}` === fCidade)
      .filter((r) => !fDestino || r.o.destino === fDestino)
      .filter((r) => fPeriodo === "todos" || r.c.historico.some((h) => now - new Date(h.fim).getTime() <= Number(fPeriodo) * 86400000))
      .filter((r) => !fAndamento || !!r.c.inicio)
      .filter(({ o }) => !q || [o.numero, o.fornecedor.nome, o.fornecedor.cidade, o.fornecedor.bairro, o.destino, ...o.itens.map((i) => i.descricao)].join(" ").toLowerCase().includes(q))
      .sort((a, b) => Number(b.o.numero) - Number(a.o.numero));
  }, [rows, busca, filtro, fCidade, fDestino, fPeriodo, fAndamento]);

  const kpi = useMemo(() => {
    const hist = rows.flatMap((r) => r.c.historico);
    const hoje = new Date().toDateString();
    const mins = hist.map((h) => (new Date(h.fim).getTime() - new Date(h.inicio).getTime()) / 60000);
    const porCidade: Record<string, number> = {};
    rows.filter((r) => r.c.status !== "coletado").forEach((r) => (porCidade[r.o.fornecedor.cidade] = (porCidade[r.o.fornecedor.cidade] || 0) + 1));
    return {
      andamento: rows.filter((r) => r.c.inicio).length,
      hoje: hist.filter((h) => new Date(h.fim).toDateString() === hoje).length,
      pendentes: rows.filter((r) => r.c.status !== "coletado").length,
      concl: rows.length ? Math.round((rows.filter((r) => r.c.status === "coletado").length / rows.length) * 100) : 0,
      media: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
      parciais: hist.filter((h) => h.tipo === "parcial").length,
      topCidades: Object.entries(porCidade).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [rows]);
  const filtrosAtivos = [filtro !== "todos", !!fCidade, !!fDestino, fPeriodo !== "todos", fAndamento, !!busca].filter(Boolean).length;
  const limpar = () => { setFiltro("todos"); setFCidade(""); setFDestino(""); setFPeriodo("todos"); setFAndamento(false); setBusca(""); };

  const ordem = new Map(rota.map((p, i) => [p.id, i + 1]));

  if (!orders.length)
    return (
      <div className="py-20 text-center">
        <MapPin className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Nenhum pedido para roteirizar</h1>
        <p className="mt-1 text-muted-foreground">Importe o ZIP com os pedidos para ver os fornecedores no mapa.</p>
        <Button className="mt-6" asChild><Link to="/importar">Importar ZIP</Link></Button>
      </div>
    );

  return (
    <>
      <PageHeader
        title="Rotas de coleta"
        subtitle={`${pontos.length}/${orders.length} no mapa · ${rota.length} na rota${rotaInfo ? ` · ${rotaInfo.km.toFixed(0)} km · ${Math.round(rotaInfo.min)} min` : ""}`}
        actions={
          <Button variant="outline" disabled={geoBusy || !pendentesGeo.length} onClick={() => void localizar()}>
            <LocateFixed className="mr-2 h-4 w-4" />
            {geoBusy ? `Localizando… (${pendentesGeo.length})` : "Localizar endereços"}
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {([
          ["Pendentes", kpi.pendentes, "a coletar", Package],
          ["Em andamento", kpi.andamento, "coletas abertas", Timer],
          ["Coletas hoje", kpi.hoje, "finalizadas", CalendarCheck],
          ["Conclusão", `${kpi.concl}%`, "pedidos coletados", TrendingUp],
          ["Tempo médio", kpi.media ? `${kpi.media} min` : "—", "por coleta", Clock],
          ["Rota atual", rotaInfo ? `${rotaInfo.km.toFixed(0)} km` : `${rota.length}`, rotaInfo ? `${rota.length} paradas · ${Math.round(rotaInfo.min)} min` : "paradas", Route],
        ] as const).map(([t, v, s, Icon]) => (
          <div key={t} className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t}<Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{v}</div>
            <div className="text-xs text-muted-foreground">{s}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Distribuição por status</span>
            <span className="text-xs text-muted-foreground">{rows.length} pedidos · {kpi.parciais} coletas parciais</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {STATUSES.map((s) => {
              const n = rows.filter((r) => r.c.status === s).length;
              return n ? <div key={s} style={{ width: `${(n / rows.length) * 100}%`, background: `var(--status-${s})` }} title={`${COLETA_LABEL[s]}: ${n}`} /> : null;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["todos", ...STATUSES] as const).map((s) => (
              <button key={s} onClick={() => setFiltro(s)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition", filtro === s ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                {s !== "todos" && <span className="h-2 w-2 rounded-full" style={{ background: `var(--status-${s})` }} />}
                {s === "todos" ? "Todos" : COLETA_LABEL[s]}
                <span className="font-mono opacity-70">{s === "todos" ? rows.length : rows.filter((r) => r.c.status === s).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Pendências por cidade</div>
          <div className="space-y-2">
            {kpi.topCidades.map(([cid, n]) => (
              <button key={cid} onClick={() => setFCidade(cidades.find((x) => x.startsWith(cid + "/")) ?? "")} className="block w-full text-left text-xs">
                <div className="flex justify-between"><span className="truncate">{cid}</span><span className="font-mono">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / (kpi.topCidades[0]?.[1] || 1)) * 100}%` }} /></div>
              </button>
            ))}
            {!kpi.topCidades.length && <div className="text-xs text-muted-foreground">Sem pendências.</div>}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <span className="mr-1 text-sm font-semibold">Filtros gerenciais</span>
        <select value={fCidade} onChange={(e) => setFCidade(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Todas as cidades</option>
          {cidades.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={fDestino} onChange={(e) => setFDestino(e.target.value)} className="h-9 max-w-52 rounded-md border bg-background px-2 text-sm">
          <option value="">Todos os destinos</option>
          {destinos.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={fPeriodo} onChange={(e) => setFPeriodo(e.target.value as typeof fPeriodo)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="todos">Qualquer período</option>
          <option value="1">Coletados hoje/24h</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </select>
        <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
          <input type="checkbox" checked={fAndamento} onChange={(e) => setFAndamento(e.target.checked)} className="accent-primary" />Só em andamento
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span><b className="text-foreground">{lista.length}</b> de {rows.length}</span>
          {filtrosAtivos > 0 && <Button size="sm" variant="ghost" onClick={limpar}><X className="mr-1 h-3.5 w-3.5" />Limpar ({filtrosAtivos})</Button>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="h-[55vh] overflow-hidden rounded-lg border bg-card lg:h-[72vh]">
          <ClientOnly fallback={<div className="grid h-full place-items-center text-muted-foreground">Carregando mapa…</div>}>
            <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">Carregando mapa…</div>}>
              <RouteMap pontos={pontos} rota={rota} rotaGeo={rotaGeo} selecionado={sel} onSelect={setSel} />
            </Suspense>
          </ClientOnly>
        </div>
        <div className="flex flex-col rounded-lg border bg-card lg:h-[72vh]">
          <div className="relative border-b p-3">
            <Search className="absolute left-5 top-5.5 h-4 w-4 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por pedido, fornecedor, cidade, item…" className="w-full rounded-md border bg-background py-2 pl-8 pr-2 text-sm" />
          </div>
          <ul className="flex-1 divide-y overflow-y-auto">
            {lista.map(({ o, c }) => (
              <li key={o.id} className={cn("p-3 text-sm", sel === o.id && "bg-muted/60")}>
                <button className="w-full text-left" onClick={() => setSel(o.id)}>
                  <div className="flex items-center gap-2">
                    {ordem.has(o.id) && <span className="pin pin-rota !h-5 !w-5 text-[10px]">{ordem.get(o.id)}</span>}
                    <span className="font-mono font-medium">PC {o.numero}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.lat == null ? (c.geoFalhou ? "sem localização" : "localizando…") : ""}</span>
                  </div>
                  <div className="truncate">{o.fornecedor.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.fornecedor.endereco} · {o.fornecedor.cidade}/{o.fornecedor.uf}</div>
                </button>
                {sel === o.id && (
                  <div className="mt-2 space-y-2">
                    <select value={c.status} onChange={(e) => setColeta(o.id, { status: e.target.value as ColetaStatus })} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                      {STATUSES.map((s) => <option key={s} value={s}>{COLETA_LABEL[s]}</option>)}
                    </select>
                    {c.status === "rota" && !c.inicio && (
                      <Button size="sm" className="w-full" onClick={() => setColeta(o.id, { inicio: new Date().toISOString() })}><Play className="mr-1 h-4 w-4" />Iniciar coleta</Button>
                    )}
                    {c.inicio && (
                      <>
                        <div className="rounded-md border bg-background px-2 py-1.5 text-xs">
                          <span className="font-medium text-primary">Coleta em andamento</span>
                          <div className="text-muted-foreground">Início: {dataDia(c.inicio)} às {horaMin(c.inicio)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button size="sm" onClick={() => { const fim = new Date().toISOString(); setColeta(o.id, { inicio: undefined, status: "coletado", historico: [...c.historico, { inicio: c.inicio!, fim, tipo: "total" }] }); log("Coleta", `Coleta total em ${dataDia(fim)} · ${horaMin(c.inicio!)} → ${horaMin(fim)}`, o.id); }}><CheckCircle2 className="mr-1 h-4 w-4" />Total</Button>
                          <Button size="sm" variant="outline" onClick={() => { const fim = new Date().toISOString(); setColeta(o.id, { inicio: undefined, status: "aguardando", historico: [...c.historico, { inicio: c.inicio!, fim, tipo: "parcial" }] }); log("Coleta", `Coleta parcial em ${dataDia(fim)} · ${horaMin(c.inicio!)} → ${horaMin(fim)}`, o.id); }}><CircleDashed className="mr-1 h-4 w-4" />Parcial</Button>
                        </div>
                      </>
                    )}
                    {c.historico.length > 0 && (
                      <div className="space-y-1 rounded-md border bg-background p-2">
                        <div className="text-xs font-medium">Histórico de coletas</div>
                        {c.historico.map((h, k) => (
                          <div key={k} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{h.tipo === "total" ? "Total" : "Parcial"}</span> · {dataDia(h.inicio)} · {horaMin(h.inicio)} → {horaMin(h.fim)} ({duracao(h.inicio, h.fim)})
                          </div>
                        ))}
                      </div>
                    )}
                    <Link to="/pedidos/$id" params={{ id: o.id }} className="block text-xs text-primary underline">Abrir pedido</Link>
                  </div>
                )}
              </li>
            ))}
            {!lista.length && <li className="p-6 text-center text-muted-foreground">Nenhum pedido.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
