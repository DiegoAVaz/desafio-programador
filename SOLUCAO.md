# Solução — Quick Filler

## Visão geral

O Quick Filler recebe um PDF de cartão de ponto ou holerite, processa-o de forma assíncrona, permite revisão humana e exporta a transcrição corrigida em XLSX, CSV ou JSON.

O projeto possui um frontend React/Vite e um backend Node.js/Express. Ambos compartilham o mesmo fluxo de upload, polling, edição e download; apenas os parsers e a forma da planilha diferem entre os tipos de documento.

## Como executar

### Sem Docker

Em dois terminais:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`. Durante o desenvolvimento, o Vite encaminha chamadas `/api` ao backend em `http://localhost:3000`.

### Com Docker

Com Docker Desktop instalado e em execução, na raiz do repositório:

```powershell
docker compose up --build
```

Abra `http://localhost:8080`. O frontend é servido por Nginx e encaminha `/api` e `/healthz` ao backend pela rede interna do Compose.

Para encerrar os containers:

```powershell
docker compose down
```

## Arquitetura e decisões

- O `POST /api/transcricoes` cria um registro em memória com status `processando` e responde imediatamente com `202`.
- O frontend consulta o `GET /api/transcricoes/:id` a cada dois segundos até o estado terminal.
- O backend usa a camada de texto do PDF quando ela é útil e aplica OCR como fallback para documentos escaneados.
- Parsers modulares tratam layouts conhecidos de cartão e holerite. Layout não reconhecido termina em erro explícito, em vez de criar dados falsos.
- Valores monetários permanecem strings brasileiras; `fields` contém verbas e `bases` contém totais/bases separadas.
- A exportação XLSX usa ExcelJS para persistir cabeçalho azul, avisos amarelos e erros vermelhos no próprio arquivo.

## Segurança e privacidade

- O upload exige o tipo `cartao-ponto` ou `holerite`, aceita somente MIME PDF e limita o arquivo a 10 MiB.
- Arquivos corrompidos entram no fluxo assíncrono e terminam com mensagem de erro legível.
- Erros conhecidos de upload retornam JSON e não expõem stack trace.
- Não há logs de conteúdo de documento ou PII no backend.

## Retenção de dados

As transcrições e correções são mantidas apenas em memória no processo do backend. Elas existem entre upload e download, mas são apagadas ao reiniciar o servidor ou o container. Não há banco de dados, volume persistente ou armazenamento de PDFs em disco.

Isso foi escolhido para o escopo do desafio. Em produção, seria necessário definir autenticação, armazenamento criptografado, prazo de retenção, exclusão auditável e limites de concorrência por usuário.

## Limitações conhecidas

- A qualidade do OCR depende da qualidade visual do PDF. Campos incertos usam `?` em vez de uma correção silenciosa.
- `time-card-04.pdf` não possui evidência suficiente para transcrição confiável e retorna erro explícito.
- O repositório armazena transcrições apenas em memória; não suporta retomada após reinício.
- A validação de upload usa MIME e processamento do PDF. Uma validação estrutural adicional do cabeçalho PDF seria apropriada em uma versão produtiva.

## Testes escolhidos

```powershell
cd backend
npm.cmd test
npm.cmd run test:extract
```

Os testes automatizados cobrem os riscos de maior impacto: contrato HTTP de upload, fronteira de 10 MiB, preservação de `fields`/`bases`, referência concatenada, geração das três exportações e estilos do XLSX. O script `test:extract` executa regressão nos oito PDFs reais, incluindo OCR.
