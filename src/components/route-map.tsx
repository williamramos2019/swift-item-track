import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEPOSITO, type Ponto } from "@/lib/rota";
import { COLETA_LABEL } from "@/lib/types";

type Props = {
  pontos: Ponto[];
  rota: Ponto[];
  rotaGeo: [number, number][] | null;
  selecionado: string | null;
  onSelect: (id: string) => void;
};

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export default function RouteMap({ pontos, rota, rotaGeo, selecionado, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView([DEPOSITO.lat, DEPOSITO.lng], 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 19 }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const ordem = new Map(rota.map((p, i) => [p.id, i + 1]));
    if (rota.length) {
      const line: [number, number][] = rotaGeo ?? [[DEPOSITO.lat, DEPOSITO.lng], ...rota.map((p) => [p.lat, p.lng] as [number, number]), [DEPOSITO.lat, DEPOSITO.lng]];
      L.polyline(line, { color: cssVar("--status-rota"), weight: 5, opacity: 0.85, dashArray: rotaGeo ? undefined : "6 8" }).addTo(g);
    }
    const depot = L.divIcon({ className: "", html: `<div class="pin pin-depot">D</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker([DEPOSITO.lat, DEPOSITO.lng], { icon: depot, zIndexOffset: 1000 }).bindTooltip(DEPOSITO.nome).addTo(g);
    const bounds: [number, number][] = [[DEPOSITO.lat, DEPOSITO.lng]];
    for (const p of pontos) {
      bounds.push([p.lat, p.lng]);
      const n = ordem.get(p.id);
      const icon = L.divIcon({ className: "", html: `<div class="pin pin-${p.status}${p.id === selecionado ? " pin-sel" : ""}">${n ?? ""}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
      L.marker([p.lat, p.lng], { icon, zIndexOffset: n ? 500 : 0 })
        .bindTooltip(`<b>PC ${p.numero}</b> · ${p.empresa}<br/>${COLETA_LABEL[p.status]}`)
        .on("click", () => onSelect(p.id))
        .addTo(g);
    }
    if (!fitted.current && bounds.length > 1) {
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      fitted.current = true;
    }
  }, [pontos, rota, rotaGeo, selecionado, onSelect]);

  useEffect(() => {
    const p = pontos.find((x) => x.id === selecionado);
    if (p && map.current) map.current.panTo([p.lat, p.lng]);
  }, [selecionado]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="h-full w-full" />;
}
