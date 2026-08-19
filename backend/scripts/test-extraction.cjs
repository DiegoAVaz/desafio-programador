const fs = require('fs');
const path = require('path');
require('ts-node/register');

const { processarArquivo } = require('../src/services/pdfProcessor');

const exemplosDir = path.resolve(__dirname, '../../exemplos');

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

(async () => {
  for (const { file, tipo } of arquivos) {
    const buffer = fs.readFileSync(path.join(exemplosDir, file));
    console.log(`\n=== ${file} (${tipo}) ===`);
    try {
      const resultado = await processarArquivo(tipo, buffer);
      const pages = resultado.pages ?? [];
      console.log(`Páginas: ${pages.length}`);
      if (tipo === 'cartao-ponto') {
        const totalDias = pages.reduce((acc, p) => acc + (p.days?.length ?? 0), 0);
        console.log(`Total dias: ${totalDias}`);
        const primeiro = pages[0]?.days?.[0];
        const ultimo = pages[pages.length - 1]?.days?.slice(-1)[0];
        console.log(`Primeiro dia: ${primeiro?.date_raw} (${primeiro?.punches?.length ?? 0} batidas)`);
        console.log(`Último dia: ${ultimo?.date_raw} (${ultimo?.punches?.length ?? 0} batidas)`);
      } else {
        console.log(`Competências: ${pages.map((p) => `${p.month}/${p.year}`).join(', ')}`);
        console.log(`Fields pág.1: ${pages[0]?.fields?.length ?? 0}, bases: ${pages[0]?.bases?.length ?? 0}`);
      }
    } catch (erro) {
      console.log(`ERRO: ${erro.message}`);
    }
  }
})();
