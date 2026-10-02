import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { useStore } from "@/lib/store";
import { dt } from "@/lib/format";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/historico")({
  head: () => meta("Histórico e auditoria", "Histórico de importações de ZIP e trilha de auditoria de conferências e estornos."),
  component: History,
});

function History() {
  const { imports, audit, orders } = useStore();
  return (
    <>
      <PageHeader title="Histórico e auditoria" />
      <h2 className="mb-2 font-semibold">Importações</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-3">Data</th><th className="p-3">Arquivo</th><th className="p-3">Usuário</th><th className="p-3">Novos</th><th className="p-3">Revisões</th><th className="p-3">Repetidos</th><th className="p-3">Ignorados</th><th className="p-3">Erros</th></tr></thead>
          <tbody>
            {imports.map((i) => (
              <tr key={i.id} className="border-t"><td className="p-3">{dt(i.data)}</td><td className="p-3 break-all">{i.arquivo}</td><td className="p-3">{i.usuario}</td><td className="p-3">{i.novos.length}</td><td className="p-3">{i.revisoes.length}</td><td className="p-3">{i.repetidos.length}</td><td className="p-3">{i.ignorados.length}</td><td className="p-3" title={i.erros.join("\n")}>{i.erros.length}</td></tr>
            ))}
            {!imports.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma importação.</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="mb-2 font-semibold">Trilha de auditoria</h2>
      <ul className="divide-y rounded-lg border bg-card text-sm">
        {audit.slice(0, 300).map((a) => {
          const o = orders.find((x) => x.id === a.orderId);
          return (
            <li key={a.id} className="flex flex-wrap gap-x-3 p-3">
              <span className="text-muted-foreground">{dt(a.data)}</span><span className="font-medium">{a.acao}</span>
              {o && <Link to="/pedidos/$id" params={{ id: o.id }} className="font-mono text-primary">PC {o.numero}</Link>}
              <span>{a.detalhe}</span><span className="ml-auto text-xs text-muted-foreground">{a.usuario}</span>
            </li>
          );
        })}
        {!audit.length && <li className="p-6 text-center text-muted-foreground">Sem registros.</li>}
      </ul>
    </>
  );
}
