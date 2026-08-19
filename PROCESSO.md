# Processo de desenvolvimento

> Antes da entrega, o autor deve revisar este documento e completar a seção final com fatos pessoais. Ela não deve atribuir ao autor ações que não realizou.

## Ferramentas usadas

- Codex/assistente de IA: leitura do enunciado, inspeção de código, implementação incremental, criação de testes e validações locais.
- Node.js, TypeScript e Vitest: testes de contrato HTTP, parser e exportação.
- ExcelJS: geração de XLSX com estilos persistentes.
- Tesseract.js, `pdf-parse` e PDF.js: extração de camada de texto e OCR de fallback.

## Erros percebidos e correções

1. No layout `Folha Normal` do `payroll-01`, a referência e o valor podiam chegar concatenados (`030,67`). O parser passou a separar apenas casos com evidência de concatenação, preservando valores monetários legítimos.
2. A primeira exportação XLSX usava uma biblioteca que aceitava objetos de estilo em memória, mas não os persistia no arquivo gerado. Isso foi descoberto ao inspecionar o XML do XLSX em um teste de QA. A exportação foi migrada para ExcelJS e ganhou testes de cabeçalho, avisos e bordas.
3. O limite configurado inicialmente rejeitava arquivos de exatamente 10 MiB por causa da semântica do parser multipart. Um teste de fronteira revelou o problema; o limite técnico foi ajustado para aceitar 10 MiB e rejeitar o byte seguinte.

## Decisões técnicas

1. **Fila assíncrona em memória em vez de processar no request.** OCR pode levar tempo; devolver `202` e usar polling evita encerrar a conexão enquanto a extração acontece. Para o escopo sem autenticação e banco, memória reduz a complexidade, com a limitação documentada de perda após reinício.
2. **Erro explícito para layout sem evidência suficiente.** A escolha favorece honestidade: uma transcrição incompleta com `?` é aceitável quando há leitura parcial auditável; dados inventados não são.
3. **Frontend com API relativa e proxy Nginx.** O mesmo build funciona em Docker e produção sem URL fixa. No desenvolvimento, o proxy do Vite encaminha as chamadas ao backend local.

## O que quebra primeiro em produção

O armazenamento em memória é a primeira limitação: reinícios removem transcrições e múltiplas instâncias não compartilham estado. Em seguida vêm capacidade de OCR, concorrência e necessidade de controle de acesso para documentos sensíveis.

## Onde há menor confiança

Layouts de baixa qualidade ou manuscritos podem exigir OCR mais especializado ou uma revisão humana mais extensa. A solução prioriza não inventar valores e pode retornar erro quando não encontra evidência suficiente.

## Revisão do autor antes da entrega

### Minha participação

Utilizei na maior parte do tempo o Codex neste projeto. Antes disto, ao analisar a primeira versão do backend que fiz no Cursor, identifiquei que a implementação dele colocava muitas responsabilidades nas rotas: regra de negócio e controle http estavam misturados. Propus a reorganização em mais camadas, como controller, useCase e repository. Posteriormente sugeri também fatory e o contrato (interface) entre a camada do use case e o repository. Mas implementação da mudança foi realizada com auxílio do Codex; eu não reescrevi manualmente esses trechos.

Tbm realizei manualmente as validações:
- instalei e configurei o Docker Desktop (como há tempos não utilizava Docker, pedi ajuda para o Codex me guiar na configuração);
- validei o compose up build localmente;
- confirmei o endpoint healthz (Docker);
- abri e testei os fluxos de cartão de ponto e holerite no ambiente Docker;
- criei e configurei os dois serviços no Render;
- validei a aplicação publicada, uploads, downloads, etc

### Decisões minhas

- Solicitar a reorganização do backend em arquitetura em camadas.
- Priorizar uma solução que não inventasse dados quando o OCR ou o layout não fornecessem evidência suficiente.
- Exigir testes além do fluxo do normal, limites de upload, contratos HTTP, exportação, persistencia, etc
- Escolher o Render para publicação após avaliar alternativas
- Manter a aplicação publicada em duas partes: frontend e backend.

### Decisões propostas e implementadas com o assistente

- Fila assíncrona em memória, com resposta `202` e polling, para não prender a requisição durante OCR.
- Parsers separados por tipo/layout de documento, com OCR de fallback.
- Middleware global para erros de upload, retornando JSON e os status `400`, `413` ou `500`.
- Migração da exportação XLSX para ExcelJS, para persistir estilos de cabeçalho e destaques no arquivo baixado.
- Testes automatizados com Vitest e Supertest para parsers, API e exportações.
- Separação de frontend e backend no Docker Compose.
- Proxy Nginx para o frontend chamar a API pelo caminho relativo `/api`.
- Correção da configuração HTTPS/SNI do proxy Nginx para permitir a comunicação entre os dois serviços do Render.

### Publicação

- Plataforma usada: Render
- Aplicação pública: https://quick-filler-desafio-web-diegoalves.onrender.com/
- Backend: https://quick-filler-desafio-diegoalves.onrender.com/healthz