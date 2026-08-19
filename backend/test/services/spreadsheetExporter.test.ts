import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { exportarPlanilha } from '../../src/services/spreadsheetExporter';

describe('exportarPlanilha', () => {
  const cartao = {
    pages: [{ page: 1, days: [
      { date_raw: '01/01/2020', punches: [{ kind: 'IN' as const, time_raw: '08:00', time_hhmm: '08:00' }] },
      { date_raw: '03/01/2020', punches: [] },
    ] }],
  };

  it('gera CSV UTF-8 e JSON com os dados sem transformação', async () => {
    const [csv, json] = await Promise.all([
      exportarPlanilha('cartao-ponto', cartao, 'csv'),
      exportarPlanilha('cartao-ponto', cartao, 'json'),
    ]);

    expect(csv.body).toBe('\uFEFFData,Entrada 1\r\n01/01/2020,08:00\r\n03/01/2020,');
    expect(JSON.parse(String(json.body))).toEqual(cartao);
  });

  it('gera XLSX com cabeçalho e avisos estilizados', async () => {
    const exported = await exportarPlanilha('cartao-ponto', cartao, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(exported.body));
    const sheet = workbook.getWorksheet('Cartão de Ponto');

    expect(sheet?.getRow(1).values).toEqual([, 'Data', 'Entrada 1']);
    expect(sheet?.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FF173772' } });
    expect(sheet?.getCell('A1').font).toMatchObject({ color: { argb: 'FFFFFFFF' }, bold: true });
    expect(sheet?.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFFFF3CD' } });
    expect(sheet?.getCell('A3').fill).toMatchObject({ fgColor: { argb: 'FFF8D7DA' } });
    expect(sheet?.getCell('A3').border).toMatchObject({ left: { style: 'thin', color: { argb: 'FFDC3545' } } });
  });

  it('forma a matriz de holerite pela primeira ocorrência das verbas', async () => {
    const holerite = {
      pages: [
        { page: 1, month: '01', year: '2020', fields: [{ code: '1', label: 'Salário', reference: '', value: '1.000,00' }], bases: [] },
        { page: 2, month: '02', year: '2020', fields: [{ code: '2', label: 'INSS', reference: '', value: '100,00' }, { code: '1', label: 'Salário', reference: '', value: '1.000,00' }], bases: [] },
      ],
    };
    const exported = await exportarPlanilha('holerite', holerite, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(exported.body));
    const sheet = workbook.getWorksheet('Holerite');

    expect(sheet?.getRow(1).values).toEqual([, 'Pág.', 'Mês', 'Ano', 'Salário', 'INSS']);
    expect(sheet?.getRow(2).values).toEqual([, 1, '01', '2020', '1.000,00', '']);
    expect(sheet?.getRow(3).values).toEqual([, 2, '02', '2020', '1.000,00', '100,00']);
  });
});
