# Plano de Ação - Quick Filler (Status do Projeto)

## ✅ FASE 1: Setup e Esqueleto
- [x] Criar monorepo (Backend Node/TS e Frontend Vite/React).
- [x] Configurar Clean Architecture no backend (Repository, UseCases, Controller, Factory).
- [x] Criar rotas mockadas que devolvem o contrato JSON literal.

## ✅ FASE 2: Interface de Revisão
- [x] Criar componente de Upload.
- [x] Criar Visualizador de PDF com `iframe` lado a lado.
- [x] Criar Tabela Editável (Componentes Controlados).
- [x] Aplicar regras visuais (Fundo amarelo para `?` e borda vermelha para quebra de sequência).

## ✅ FASE 3: O Motor de Extração
- [x] Backend: Configurar `multer` para receber o upload do arquivo físico.
- [x] Backend: Instalar e configurar `pdf-parse` para extrair texto da camada do PDF.
- [x] Backend: Criar fallback para OCR (Tesseract.js + rasterização via pdfjs) para PDFs escaneados.
- [x] Backend: Criar parsers modulares por layout (`cartaoPontoParser`, `holeriteParser`).
- [x] Backend: Criar Fila Assíncrona (status 'processando' -> 'concluido').
- [x] Backend: Remover fallbacks que inventavam dados; retornar erro quando layout não é reconhecido.

<!-- Layouts suportados: SIPON (time-card-01), Banco do Brasil OCR (time-card-02), data completa OCR (time-card-03), demonstrativo/payroll-03, Folha Normal/payroll-01, Declaração/payroll-02. OCR de baixa qualidade (time-card-04, payroll-04) ainda pendente. -->

## 🗓️ FASE 4: Fechando o Ciclo
- [x] Backend: Implementar `PUT /api/transcricoes/:id` para salvar as edições feitas na interface.
- [x] Backend: Implementar `GET /api/transcricoes/:id/planilha` usando a biblioteca `xlsx`.
- [x] Frontend: Conectar o botão "Baixar Planilha" à rota de download.

## 🗓️ FASE 5: Operação e Entregáveis
- [x] Criar `Dockerfile` para Front e Back.
- [x] Criar `docker-compose.yml` finalizando a orquestração.
- [x] Escrever `SOLUCAO.md` e `PROCESSO.md`.
- [x] Validar `docker compose up --build` localmente.
- [x] Gerar e versionar as planilhas dos PDFs em `exemplos/`.
- [ ] Publicar a aplicação e registrar a URL no `PROCESSO.md`.
