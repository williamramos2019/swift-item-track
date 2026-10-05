# Lovable Inventory Flow

Crie em React uma aplicação web completa e responsiva para **gestão de pedidos, conferência e recebimento do almoxarifado da Drilling do Brasil**.

Contexto e fluxo operacional:
O setor de compras envia pedidos em PDF via WhatsApp. O gestor importa o arquivo ZIP contendo esses documentos, visualiza e revisa os dados extraídos, valida divergências e aprova/distribui os pedidos aos conferentes. Quando os fornecedores entregam os materiais, o conferente acessa o sistema pelo celular no almoxarifado e registra a conferência e o recebimento item por item.

Requisitos funcionais:

1. Importação inteligente de ZIP e processamento de PDFs:
- Upload e descompactação de arquivos ZIP recebidos do WhatsApp.
- Leitura e extração estruturada de dados dos pedidos de compra em PDF padrão SAP Business One (conforme modelos no ZIP anexado).
- Ignorar arquivos irrelevantes: conversas de texto (.txt), comprovantes diversos, CRLV/CNH e fotos/imagens do WhatsApp que não sejam pedidos.
- Extrair com fidelidade:
  * Número do pedido e data de emissão.
  * Empresa/filial compradora (ex: Drilling do Brasil Serviços de Fundação Ltda, CNPJ, IE, endereço).
  * Fornecedor: razão social, CNPJ, IE, endereço completo, contato.
  * Comprador/vendedor, condições de pagamento, frete e finalidade.
  * Previsão de entrega, destino físico / equipamento (ex: MBG-24, DEPOSITO, SG35) e observações completas.
  * Itens: sequência, código do item, descrição integral, unidade de medida, quantidade pedida, valor unitário, valor total e previsão de entrega por item.
  * Totais de produtos, despesas, descontos e tributos (IPI, ICMS, ST).
- Tratamento de divergências (exemplo PC 4680): detectar e alertar visualmente quando houver incoerências (ex: data de entrega anterior à emissão, datas na observação como "DISPONIVEL 06/10").
- Apresentar tela de prévia editável para que o gestor revise antes de aprovar e persistir.

2. Controle de duplicidades e versões:
- Identificação de arquivos repetidos por hash SHA-256.
- Unicidade de pedido garantida por Filial + Fornecedor + Número do Pedido.
- Suporte a reimportações: se um pedido já existente for importado com alterações, registrar como nova revisão para aprovação do gestor, preservando históricos e recebimentos parciais anteriores.
- Resumo pós-importação: novos pedidos cadastrados, repetidos ignorados, revisões detectadas e eventuais erros.

3. Perfis e interfaces (Gestor e Conferente):
- Perfil Gestor:
  * Visão global de todos os pedidos, histórico de importações, fila de aprovação e divergências.
  * Filtros dinâmicos por número do pedido, fornecedor, período de entrega, equipamento/destino e status.
  * Atribuição de pedidos para conferentes específicos ou liberação para a fila geral.
- Perfil Conferente (Interface Mobile-First responsiva):
  * Acesso rápido via celular aos pedidos aguardando recebimento.
  * Modal/detalhes objetivos do pedido com código, descrição completa e saldo pendente por item.
  * Formulário de registro de entrega: data/hora, número da NF do fornecedor, responsável, quantidade apresentada, quantidade aceita e quantidade recusada por item.
  * Registro de faltas, avarias ou itens incorretos com observações detalhadas.
  * Validação para impedir recebimento além do saldo pedido sem autorização.

4. Controle de saldos, auditoria e status:
- Cálculo em tempo real do saldo restante por item (Quantidade Pedida - Quantidade Aceita Acumulada).
- Suporte a entregas fracionadas / múltiplos recebimentos parciais para o mesmo pedido.
- Status do fluxo bem definidos: Em Revisão, Aprovado, Aguardando Recebimento, Recebido Parcial, Recebido Total, Com Divergência.
- Histórico auditável de conferências e estornos.

5. Dashboard e indicadores:
- Painel com cards de métricas: pedidos pendentes de entrega, recebimentos parciais em andamento, pedidos concluídos recentemente e divergências em aberto.
- Design profissional, limpo, responsivo e totalmente em português.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://swift-item-track.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/92ab0c9b-e977-4910-a998-0d317fbba5ff).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
