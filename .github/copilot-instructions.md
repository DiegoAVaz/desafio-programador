# Contexto do Projeto: Desafio Quick Filler
Você é um desenvolvedor Sênior Fullstack. Estamos construindo um sistema de transcrição de PDFs trabalhistas (Cartões de Ponto e Holerites) com OCR e revisão humana.
A arquitetura é um monorepo: `frontend` em React (Vite) e `backend` em Node.js (Express). Ambos orquestrados via Docker Compose.

## ⚠️ Regras Absolutas de Negócio (NÃO NEGOCIÁVEIS)
1. **Incerteza do OCR:** Se um caractere for ilegível, substitua APENAS o caractere por `?` (ex: `0?:25`, `2.3?9,77`). NUNCA invente valores.
2. **Formato Monetário:** Valores financeiros devem permanecer como STRING no formato brasileiro (`"2.389,77"`). NUNCA converta para Float ou Number.
3. **Preservação de Dados:** Sempre guarde o original e o processado (ex: `date_raw` e `time_hhmm`).
4. **Holerite (Verbas vs Bases):** `Base INSS`, `Base IR`, `FGTS` e `Valor Líquido` pertencem a `bases[]`. Demais vencimentos/descontos em `fields[]`.
5. **Ordem:** O array `days[]` ou `pages[]` deve seguir rigorosamente a ordem visual do PDF original.

## 🔒 Contrato da API Rigoroso
- POST `/api/transcricoes` (recebe multipart/form-data com `arquivo` e `tipo`) -> Retorna `202 Accepted` com `{ "id": "..." }`.
- GET `/api/transcricoes/:id` -> Retorna `200 OK` com status (`processando`, `concluido`, `erro`) e `value`.
- PUT `/api/transcricoes/:id` -> Recebe as edições.
- GET `/api/transcricoes/:id/planilha` -> Retorna arquivo final.

## 🛠️ Regras de Geração de Código
- Seja conciso. Mostre apenas as alterações necessárias.
- Foque nas bibliotecas modernas do React 19+ estipuladas no package.json.
- NÃO crie duas lógicas ou pipelines separados para Holerite e Cartão. Use funções modulares genéricas.