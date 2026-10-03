import type { ColetaStatus } from "./types";

export const DEPOSITO = { lat: -19.6986, lng: -43.9586, nome: "Drilling do Brasil — Depósito (São José da Lapa)" };

export interface Ponto {
  id: string;
  numero: string;
  empresa: string;
  status: ColetaStatus;
  lat: number;
  lng: number;
}

export function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Nearest-neighbour ordering starting from the depot. */
export function ordenarRota<T extends { lat: number; lng: number }>(ps: T[]): T[] {
  const rest = [...ps];
  const out: T[] = [];
  let cur: { lat: number; lng: number } = DEPOSITO;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => {
      const d = distKm(cur, p);
      if (d < bd) (bd = d), (bi = i);
    });
    const n = rest.splice(bi, 1)[0]!;
    out.push(n);
    cur = n;
  }
  return out;
}
