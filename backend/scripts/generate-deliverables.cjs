const fs = require('fs');
const path = require('path');
require('ts-node/register');

const { processarArquivo } = require('../src/services/pdfProcessor');
const { exportarPlanilha } = require('../src/services/spreadsheetExporter');

const exemplosDir = path.resolve(__dirname, '../../exemplos');
const outputDir = path.resolve(__dirname, '../../entregaveis');
const arquivos = [
  { file: 'time-card-01.pdf', tipo: 'cartao-ponto' },
  { file: 'time-card-02.pdf', tipo: 'cartao-ponto' },
  { file: 'time-card-03.pdf', tipo: 'cartao-ponto' },
  { file: 'time-card-04.pdf', tipo: 'cartao-ponto' },
  { file: 'payroll-01.pdf', tipo: 'holerite' },
  { file: 'payroll-02.pdf', tipo: 'holerite' },
  { file: 'payroll-03.pdf', tipo: 'holerite' },
  { file: 'payroll-04.pdf', tipo: 'holerite' },
];

const extension = { xlsx: 'xlsx', csv: 'csv', json: 'json' };

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = [];

  for (const { file, tipo } of arquivos) {
    const basename = path.basename(file, '.pdf');
    try {
      const buffer = fs.readFileSync(path.join(exemplosDir, file));
      const value = await processarArquivo(tipo, buffer);

      for (const formato of ['xlsx', 'csv', 'json']) {
        const output = await exportarPlanilha(tipo, value, formato);
        const target = path.join(outputDir, `${basename}.${extension[formato]}`);
        fs.writeFileSync(target, output.body);
      }
      summary.push({ file, status: 'concluido', pages: value.pages.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido.';
      fs.writeFileSync(path.join(outputDir, `${basename}.erro.txt`), `${message}\n`);
      summary.push({ file, status: 'erro', erro: message });
    }
  }

  fs.writeFileSync(path.join(outputDir, 'resultado-geracao.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
