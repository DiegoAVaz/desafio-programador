const COR_AMARELO = '#FFF3CD';
const COR_VERMELHO = '#F8D7DA';
const BORDA_VERMELHO = '4px solid #DC3545';

export function parseDataParaNumero(dataStr) {
  if (!dataStr || dataStr.includes('?')) return null;

  const partes = dataStr.split('/');
  if (partes.length !== 3) return null;

  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  const ano = parseInt(partes[2].length === 2 ? `20${partes[2]}` : partes[2], 10);

  if (Number.isNaN(dia) || Number.isNaN(mes) || Number.isNaN(ano)) return null;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  return ano * 10000 + mes * 100 + dia;
}

export function dataImpossivel(dataStr) {
  if (!dataStr || !dataStr.includes('/')) return false;

  const partes = dataStr.split('/');
  if (partes.length !== 3) return false;

  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);

  if (Number.isNaN(dia) || Number.isNaN(mes)) return dataStr.includes('?') === false && /[^\d/?]/.test(dataStr);
  return dia < 1 || dia > 31 || mes < 1 || mes > 12;
}

export function linhaTemIncerteza(textos) {
  return textos.some((texto) => typeof texto === 'string' && texto.includes('?'));
}

export function parseCompetencia(year, month) {
  if (!year || !month || String(year).includes('?') || String(month).includes('?')) {
    return null;
  }

  const ano = parseInt(String(year), 10);
  const mes = parseInt(String(month), 10);

  if (Number.isNaN(ano) || Number.isNaN(mes) || mes < 1 || mes > 12) return null;

  return ano * 100 + mes;
}

export function mesSeguinte(competenciaAnterior) {
  if (competenciaAnterior === null) return null;

  const ano = Math.floor(competenciaAnterior / 100);
  const mes = competenciaAnterior % 100;

  if (mes === 12) return (ano + 1) * 100 + 1;
  return ano * 100 + (mes + 1);
}

export function calcularAvisosCartao(dia, diaAnteriorLegivel) {
  const motivos = [];
  let amarelo = false;
  let vermelho = false;

  const textosLinha = [
    dia.date_raw,
    ...(dia.punches || []).map((p) => p.time_raw),
  ];

  if (linhaTemIncerteza(textosLinha)) {
    amarelo = true;
    motivos.push('Caractere ilegível (?)');
  }

  const qtdBatidas = (dia.punches || []).filter((p) => p.time_raw && p.time_raw.trim() !== '').length;
  if (qtdBatidas % 2 !== 0) {
    amarelo = true;
    motivos.push('Batidas ímpares');
  }

  if (dataImpossivel(dia.date_raw)) {
    vermelho = true;
    motivos.push('Data impossível');
  } else if (diaAnteriorLegivel) {
    const dataAtual = parseDataParaNumero(dia.date_raw);
    const dataAnterior = parseDataParaNumero(diaAnteriorLegivel.date_raw);

    if (dataAtual !== null && dataAnterior !== null && dataAtual < dataAnterior) {
      vermelho = true;
      motivos.push('Data fora de sequência');
    }
  }

  return { amarelo, vermelho, motivos: [...new Set(motivos)] };
}

export function paginaHoleriteVazia(pagina) {
  const fields = pagina.fields || [];
  const bases = pagina.bases || [];
  return fields.length === 0 && bases.length === 0;
}

export function calcularAvisosHolerite(pagina, paginaAnteriorLegivel) {
  const motivos = [];
  let amarelo = false;
  let vermelho = false;

  const textosLinha = [
    pagina.year,
    pagina.month,
    ...(pagina.fields || []).flatMap((f) => [f.label, f.reference, f.value]),
    ...(pagina.bases || []).flatMap((b) => [b.label, b.value]),
  ].map(String);

  if (linhaTemIncerteza(textosLinha)) {
    amarelo = true;
    motivos.push('Caractere ilegível (?)');
  }

  if (paginaHoleriteVazia(pagina)) {
    amarelo = true;
    motivos.push('Página vazia');
  }

  const competenciaAtual = parseCompetencia(pagina.year, pagina.month);

  if (competenciaAtual !== null && paginaAnteriorLegivel) {
    const competenciaAnterior = parseCompetencia(
      paginaAnteriorLegivel.year,
      paginaAnteriorLegivel.month,
    );
    const esperada = mesSeguinte(competenciaAnterior);

    if (competenciaAnterior !== null && esperada !== null && competenciaAtual !== esperada) {
      vermelho = true;
      motivos.push('Mês fora de sequência');
    }
  }

  return { amarelo, vermelho, motivos: [...new Set(motivos)] };
}

export function estiloLinha({ amarelo, vermelho }) {
  let backgroundColor = 'transparent';
  let borderLeft = '1px solid transparent';

  if (amarelo) backgroundColor = COR_AMARELO;
  if (vermelho) {
    backgroundColor = COR_VERMELHO;
    borderLeft = BORDA_VERMELHO;
  }

  return { backgroundColor, borderLeft };
}

export function flattenDiasCartao(pages) {
  const linhas = [];

  (pages || []).forEach((page, pageIndex) => {
    (page.days || []).forEach((dia, dayIndex) => {
      linhas.push({ pageIndex, dayIndex, dia });
    });
  });

  return linhas;
}

export function coletarLabelsHolerite(pages) {
  const labels = [];
  const vistos = new Set();

  (pages || []).forEach((page) => {
    (page.fields || []).forEach((field) => {
      if (field.label && !vistos.has(field.label)) {
        vistos.add(field.label);
        labels.push(field.label);
      }
    });
  });

  return labels;
}

export function normalizarHorario(valor) {
  if (!valor || valor.includes('?')) return valor;

  const match = valor.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return valor;

  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  return `${hh}:${mm}`;
}
