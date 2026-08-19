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

Preencha antes de enviar:

- Quais trechos você revisou ou reescreveu manualmente, e por quê.
- Quais decisões foram suas e quais foram propostas pelo assistente.
- Qual plataforma usou para publicar e a URL pública resultante.
