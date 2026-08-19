import { describe, expect, it } from 'vitest';
import { parseHolerite } from '../../src/services/parsers/holeriteParser';

describe('parseHolerite', () => {
  it('separa referência concatenada de valor no layout Folha Normal', () => {
    const result = parseHolerite(`
      Folha Normal
      Mês:abr-17
      290VA Funcionario030,67BASEDECALCULODOINSS1.260,65
      499Vale Ref Func2266,00TOTALDESCONTOS296,67
    `);

    const page = result.pages[0];
    expect(page).toMatchObject({ month: '04', year: '2017' });
    expect(page?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '290', label: 'VA Funcionario', reference: '0', value: '30,67' }),
      expect.objectContaining({ code: '499', label: 'Vale Ref Func', reference: '2', value: '266,00' }),
    ]));
    expect(page?.fields.some((field) => /base|total/i.test(field.label))).toBe(false);
    expect(page?.bases).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Base INSS', value: '1.260,65' }),
      expect.objectContaining({ label: 'Total Descontos', value: '296,67' }),
    ]));
  });
});
