import { describe, expect, it } from 'vitest';
import { parseCartaoPonto } from '../../src/services/parsers/cartaoPontoParser';

describe('parseCartaoPonto', () => {
  it('preserva a ordem, normaliza a hora e mantém dias sem batidas', () => {
    const result = parseCartaoPonto(`
      01/01/2020 SEG 8:05 12:00 13:00 17:30
      02/01/2020 TER
      Documento assinado eletronicamente em 03/01/2020
    `);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.days).toEqual([
      {
        date_raw: '01/01/2020',
        punches: [
          { kind: 'IN', time_raw: '8:05', time_hhmm: '08:05' },
          { kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' },
          { kind: 'IN', time_raw: '13:00', time_hhmm: '13:00' },
          { kind: 'OUT', time_raw: '17:30', time_hhmm: '17:30' },
        ],
      },
      { date_raw: '02/01/2020', punches: [] },
    ]);
  });

  it('não cria dias a partir de rodapés de assinatura', () => {
    const result = parseCartaoPonto(`
      01/01/2020 SEG 08:00 17:00
      Assinado eletronicamente em 02/01/2020 às 09:00
      Fls.: 1
    `);

    expect(result.pages[0]?.days).toHaveLength(1);
    expect(result.pages[0]?.days[0]?.date_raw).toBe('01/01/2020');
  });
});
