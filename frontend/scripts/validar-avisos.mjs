/**
 * Script de validação manual dos utilitários de avisos.
 * Executar: node scripts/validar-avisos.mjs
 */

import {
  calcularAvisosCartao,
  calcularAvisosHolerite,
  flattenDiasCartao,
  coletarLabelsHolerite,
} from '../src/utils/avisos.js';

const payloadCartao = {
  pages: [
    {
      page: 1,
      days: [
        {
          date_raw: '21/05/2019',
          punches: [
            { kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' },
            { kind: 'OUT', time_raw: '18:25', time_hhmm: '18:25' },
          ],
        },
        {
          date_raw: '20/05/2019',
          punches: [{ kind: 'IN', time_raw: '0?:25', time_hhmm: '0?:25' }],
        },
        { date_raw: '25/05/2019', punches: [] },
      ],
    },
  ],
};

const payloadHolerite = {
  pages: [
    {
      page: 1,
      year: '2020',
      month: '01',
      fields: [{ code: '0010', label: 'Salário Base', reference: '220,00', value: '2.389,77' }],
      bases: [{ label: 'Valor Líquido', value: '2.282,81' }],
    },
    { page: 2, year: '2020', month: '02', fields: [], bases: [] },
    {
      page: 3,
      year: '2020',
      month: '04',
      fields: [{ code: '0010', label: 'Salário Base', reference: '', value: '2.500,00' }],
      bases: [],
    },
  ],
};

const linhas = flattenDiasCartao(payloadCartao.pages);
console.log('Cartão - linhas achatadas:', linhas.length);

linhas.forEach(({ dia }, i) => {
  const anterior = linhas.slice(0, i).reverse().find(({ dia: d }) => !d.date_raw.includes('?'))?.dia ?? null;
  const avisos = calcularAvisosCartao(dia, anterior);
  console.log(`  ${dia.date_raw}:`, avisos.motivos.join(', ') || 'ok');
});

console.log('Holerite - labels:', coletarLabelsHolerite(payloadHolerite.pages));

payloadHolerite.pages.forEach((pagina, i) => {
  const anterior = payloadHolerite.pages
    .slice(0, i)
    .reverse()
    .find((p) => p.year && p.month && !String(p.year).includes('?')) ?? null;
  const avisos = calcularAvisosHolerite(pagina, anterior);
  console.log(`  Pág ${pagina.page} (${pagina.month}/${pagina.year}):`, avisos.motivos.join(', ') || 'ok');
});

console.log('\nValidação concluída.');
