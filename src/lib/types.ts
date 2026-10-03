export type OrderStatus =
  | "em_revisao"
  | "aprovado"
  | "aguardando"
  | "parcial"
  | "total"
  | "divergencia";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  em_revisao: "Em Revisão",
  aprovado: "Aprovado",
  aguardando: "Aguardando Recebimento",
  parcial: "Recebido Parcial",
  total: "Recebido Total",
  divergencia: "Com Divergência",
};

export interface Empresa {
  codigo?: string;
  nome: string;
  cnpj: string;
  ie: string;
  endereco: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep: string;
  contato?: string;
}

export interface OrderItem {
  seq: number;
  codigo: string;
  descricao: string;
  un: string;
  qtd: number;
  vlUnit: number;
  ipi: number;
  icms: number;
  st: number;
  desconto: number;
  vlTotal: number;
  dtEntrega: string; // dd/mm/aaaa
}

export interface Totais {
  produtos: number;
  despesas: number;
  desconto: number;
  total: number;
  ipi: number;
  icms: number;
  st: number;
}

export interface OrderData {
  numero: string;
  dataEmissao: string;
  dataEntrega: string;
  filial: Empresa;
  fornecedor: Empresa;
  comprador: string;
  pagamento: string;
  frete: string;
  finalidade: string;
  destino: string;
  observacoes: string;
  itens: OrderItem[];
  totais: Totais;
}

export interface Revision {
  rev: number;
  data: string;
  arquivo: string;
  hash: string;
  snapshot: OrderData;
}

export interface Order extends OrderData {
  id: string;
  key: string;
  revisao: number;
  revisoes: Revision[];
  pendingRevision?: Revision | null;
  baseStatus: "em_revisao" | "aprovado" | "liberado";
  conferente: string | null; // null = fila geral
  divergencias: string[];
  divergenciaResolvida: boolean;
  arquivo: string;
  hash: string;
  criadoEm: string;
  aprovadoEm?: string;
}

export type Ocorrencia = "" | "falta" | "avaria" | "incorreto" | "outro";

export interface ReceiptLine {
  seq: number;
  apresentada: number;
  aceita: number;
  recusada: number;
  ocorrencia: Ocorrencia;
  obs: string;
}

export interface Receipt {
  id: string;
  orderId: string;
  dataHora: string;
  nf: string;
  responsavel: string;
  conferente: string;
  linhas: ReceiptLine[];
  obs: string;
  excessoAutorizadoPor?: string | undefined;
  estornado: boolean;
  estornoMotivo?: string;
  estornoEm?: string;
  criadoEm: string;
}

export interface ImportLog {
  id: string;
  data: string;
  arquivo: string;
  usuario: string;
  novos: string[];
  repetidos: string[];
  revisoes: string[];
  ignorados: string[];
  erros: string[];
}

export interface AuditEntry {
  id: string;
  data: string;
  usuario: string;
  acao: string;
  orderId?: string | undefined;
  detalhe: string;
}

export type ColetaStatus = "aguardando" | "rota" | "estoque" | "fabricacao" | "coletado";

export const COLETA_LABEL: Record<ColetaStatus, string> = {
  aguardando: "Aguardando retirada",
  rota: "Rota de coleta",
  estoque: "Estoque",
  fabricacao: "Fabricação",
  coletado: "Coletado",
};

export interface Coleta {
  status: ColetaStatus;
  lat?: number;
  lng?: number;
  precisao?: string;
  geoFalhou?: boolean;
  inicio?: string;
  historico: { inicio: string; fim: string; tipo: "total" | "parcial" }[];
}
