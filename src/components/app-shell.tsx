import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, FileUp, ClipboardList, CheckSquare, History, Truck, Menu, X, HardHat, MapPinned , Boxes } from "lucide-react";
import { useStore, CONFERENTES } from "@/lib/store";
import { cn } from "@/lib/utils";

const gestorNav = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/importar", label: "Importar ZIP", icon: FileUp },
  { to: "/aprovacao", label: "Aprovação", icon: CheckSquare },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/rotas", label: "Rotas de coleta", icon: MapPinned },
  { to: "/conferente", label: "Recebimento", icon: Truck },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/historico", label: "Histórico", icon: History },
] as const;
const confNav = [{ to: "/conferente", label: "Meus recebimentos", icon: Truck }] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const { perfil, usuario, setPerfil, orders } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  useEffect(() => setOpen(false), [path]);

  const nav = perfil === "gestor" ? gestorNav : confNav;
  const pend = orders.filter((o) => o.baseStatus === "em_revisao" || o.pendingRevision).length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:flex lg:translate-x-0",
          open ? "flex translate-x-0" : "hidden -translate-x-full lg:flex",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">DRILLING DO BRASIL</div>
            <div className="text-xs opacity-60">Almoxarifado · Recebimento</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent",
                )}
              >
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label}</span>
                {n.to === "/aprovacao" && pend > 0 && (
                  <span className="rounded bg-destructive px-1.5 text-xs text-destructive-foreground">{pend}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <label className="mb-1 block text-xs uppercase tracking-wider opacity-60">Perfil de acesso</label>
          <select
            className="w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-2 text-sm"
            value={perfil === "gestor" ? "gestor" : usuario}
            onChange={(e) =>
              e.target.value === "gestor"
                ? setPerfil("gestor", "Gestor Almoxarifado")
                : setPerfil("conferente", e.target.value)
            }
          >
            <option value="gestor">Gestor</option>
            {CONFERENTES.map((c) => (
              <option key={c} value={c}>
                Conferente · {c}
              </option>
            ))}
          </select>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
          <span className="font-semibold">Almoxarifado Drilling</span>
          <span className="ml-auto truncate text-xs text-muted-foreground">{usuario}</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          {ready ? children : <div className="py-20 text-center text-muted-foreground">Carregando…</div>}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
