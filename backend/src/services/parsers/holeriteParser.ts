export interface HoleriteField {
  code: string;
  label: string;
  reference: string;
  value: string;
}

export interface HoleriteBase {
  label: string;
  value: string;
}

export interface HoleritePage {
  page: number;
  year: string;
  month: string;
  fields: HoleriteField[];
  bases: HoleriteBase[];
}

export interface HoleriteResult {
  pages: HoleritePage[];
}

const BLOCK_START_RE = /(?:DEMONSTRATIVODEPAGAMENTOMENSAL|Período:\s*\d{2}\/\d{4})/i;
const PERIODO_RE = /Período:\s*(\d{2})\/(\d{4})/i;
const FIELD_HEADER_RE = /Cod\.?\s*Descri/i;
const TOTAL_LINE_RE = /^Total/i;
const MONEY_RE = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
const FIELD_CODE_RE = /^(\/?[A-Z0-9]{2,4})/i;

const normalizarTexto = (texto: string): string =>
  texto
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();

const isNoiseLine = (linha: string): boolean => {
  if (!linha.trim()) return true;

  return [
    /assinado\s*eletronicamente/i,
    /^Fls\.:/i,
    /^ID\./i,
  ].some((re) => re.test(linha));
};

const splitHoleriteBlocks = (texto: string): string[] => {
  const partes = texto.split(/(?=DEMONSTRATIVODEPAGAMENTOMENSAL|Período:\s*\d{2}\/\d{4})/i);
  return partes
    .map((parte) => parte.trim())
    .filter((parte) => Boolean(parte) && PERIODO_RE.test(parte));
};

const extrairCompetencia = (bloco: string): { month: string; year: string } | null => {
  const match = bloco.match(PERIODO_RE);
  if (!match) return null;

  return {
    month: match[1] ?? '01',
    year: match[2] ?? '2000',
  };
};

const parseFieldLine = (linha: string): HoleriteField | null => {
  const codeMatch = linha.match(FIELD_CODE_RE);
  if (!codeMatch) return null;

  const code = codeMatch[1] ?? '';
  const resto = linha.slice(code.length);
  const moneyMatches = [...resto.matchAll(MONEY_RE)];

  if (moneyMatches.length === 0) return null;

  let reference = '';
  let value = '';

  if (moneyMatches.length >= 2) {
    reference = moneyMatches[moneyMatches.length - 2]?.[0] ?? '';
    value = moneyMatches[moneyMatches.length - 1]?.[0] ?? '';
  } else {
    value = moneyMatches[0]?.[0] ?? '';
  }

  const primeiroIndice = moneyMatches.length >= 2
    ? (moneyMatches[moneyMatches.length - 2]?.index ?? resto.length)
    : (moneyMatches[0]?.index ?? resto.length);

  const label = resto.slice(0, primeiroIndice).trim();
  if (!label && !value) return null;

  return { code, label, reference, value };
};

const parseTotalLine = (linha: string): HoleriteBase[] => {
  const bases: HoleriteBase[] = [];
  const moneyMatches = [...linha.matchAll(MONEY_RE)];

  if (moneyMatches.length >= 2) {
    bases.push({
      label: 'Total Vencimentos',
      value: moneyMatches[0]?.[0] ?? '',
    });
    bases.push({
      label: 'Total Descontos',
      value: moneyMatches[1]?.[0] ?? '',
    });
    return bases;
  }

  if (moneyMatches.length === 1) {
    bases.push({
      label: 'Total',
      value: moneyMatches[0]?.[0] ?? '',
    });
  }

  return bases;
};

const parseLiquidoLine = (linha: string): HoleriteBase | null => {
  const match = linha.match(/^L[ií]q[uü][íi]?do\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (!match) return null;

  return {
    label: 'Líquido',
    value: match[1] ?? '',
  };
};

const parseBasePairs = (linha: string): HoleriteBase[] => {
  const bases: HoleriteBase[] = [];
  const pairRe = /([A-Za-zÀ-ú0-9.\s]+?)[:：](\d{1,3}(?:\.\d{3})*,\d{2})/g;
  let match: RegExpExecArray | null = pairRe.exec(linha);

  while (match) {
    const label = (match[1] ?? '').trim();
    const value = match[2] ?? '';
    if (label && value) {
      bases.push({ label, value });
    }
    match = pairRe.exec(linha);
  }

  return bases;
};

const parseHoleriteBlock = (bloco: string, pageNumber: number): HoleritePage => {
  const competencia = extrairCompetencia(bloco);
  const linhas = bloco
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);

  const fields: HoleriteField[] = [];
  const bases: HoleriteBase[] = [];

  let dentroFields = false;
  let passouTotal = false;
  let viuHeader = false;

  for (const linha of linhas) {
    if (isNoiseLine(linha)) continue;

    if (FIELD_HEADER_RE.test(linha)) {
      viuHeader = true;
      dentroFields = true;
      continue;
    }

    if (!viuHeader && !BLOCK_START_RE.test(linha)) {
      continue;
    }

    if (TOTAL_LINE_RE.test(linha)) {
      bases.push(...parseTotalLine(linha));
      passouTotal = true;
      dentroFields = false;
      continue;
    }

    const liquido = parseLiquidoLine(linha);
    if (liquido) {
      bases.push(liquido);
      continue;
    }

    if (passouTotal) {
      bases.push(...parseBasePairs(linha));
      continue;
    }

    if (dentroFields) {
      const field = parseFieldLine(linha);
      if (field) {
        fields.push(field);
      }
    }
  }

  return {
    page: pageNumber,
    year: competencia?.year ?? '',
    month: competencia?.month ?? '',
    fields,
    bases,
  };
};

const MONEY_VALUE_RE = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g;

const MESES_ABREV: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
};

const BASE_TOKEN_DEFS = [
  { re: /BASEDECALCULODOINSS(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Base INSS' },
  { re: /BASEDECALCULODOIRF(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Base IR' },
  { re: /BASEDECALCULODOFGTS(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Base FGTS' },
  { re: /VALORDOFGTS(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Valor FGTS' },
  { re: /SALARIOLIQUIDONOMES(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Valor Líquido' },
  { re: /TOT\.RENDIMENTOS(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Total Vencimentos' },
  { re: /TOTALDESCONTOS(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Total Descontos' },
  { re: /VALORDOIRFARECOLHER(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi, label: 'Valor IRF a Recolher' },
];

const extrairBasesDeTexto = (texto: string): HoleriteBase[] => {
  const bases: HoleriteBase[] = [];

  for (const def of BASE_TOKEN_DEFS) {
    const regex = new RegExp(def.re.source, def.re.flags);
    let match: RegExpExecArray | null = regex.exec(texto);
    while (match) {
      bases.push({ label: def.label, value: match[1] ?? '' });
      match = regex.exec(texto);
    }
  }

  return bases;
};

/**
 * O layout "Folha Normal" não preserva a separação visual entre a coluna de
 * referência e o valor. Por exemplo, `0 30,67` chega como `030,67`.
 *
 * Só separamos quando há evidência inequívoca dessa concatenação: o valor não
 * tem separador de milhar, possui três ou mais algarismos antes da vírgula e
 * começa em zero, ou possui mais de três algarismos. Isso evita transformar
 * valores legítimos como `116,66` e `1.260,65` em dados inventados.
 */
const separarReferenciaConcatenada = (valor: string): Pick<HoleriteField, 'reference' | 'value'> => {
  if (valor.includes('.')) return { reference: '', value: valor };

  const match = valor.match(/^(\d+),(\d{2})$/);
  if (!match) return { reference: '', value: valor };

  const inteiro = match[1] ?? '';
  const centavos = match[2] ?? '';
  const temReferenciaConcatenada = inteiro.length > 3 || (inteiro.length >= 2 && inteiro.startsWith('0'));

  if (!temReferenciaConcatenada) return { reference: '', value: valor };

  return {
    reference: inteiro[0] ?? '',
    value: `${inteiro.slice(1).replace(/^0+(?=\d)/, '')},${centavos}`,
  };
};

const extrairFieldsColados = (texto: string): HoleriteField[] => {
  const fields: HoleriteField[] = [];
  let limpo = texto;

  for (const def of BASE_TOKEN_DEFS) {
    limpo = limpo.replace(def.re, ' ');
  }

  limpo = limpo.replace(/TOT\.RENDIMENTOS/gi, ' ').replace(/TOTALDESCONTOS/gi, ' ');

  const fieldRe = /(\d{3})([A-Za-zÀ-ú\/][A-Za-zÀ-ú0-9\s\/\.\-%]*?)((?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})+)/g;
  let match: RegExpExecArray | null = fieldRe.exec(limpo);

  while (match) {
    const code = match[1] ?? '';
    const label = (match[2] ?? '').trim();
    const valores = match[3] ?? '';
    const moneyParts = [...valores.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g)].map((m) => m[0]);

    if (label && moneyParts.length > 0) {
      const ultimoValor = moneyParts[moneyParts.length - 1] ?? '';
      const referenciaEValor = moneyParts.length >= 2
        ? { reference: moneyParts[moneyParts.length - 2] ?? '', value: ultimoValor }
        : separarReferenciaConcatenada(ultimoValor);

      fields.push({
        code,
        label,
        ...referenciaEValor,
      });
    }

    match = fieldRe.exec(limpo);
  }

  return fields;
};

const parseFolhaNormalBlock = (bloco: string, pageNumber: number): HoleritePage | null => {
  const mesMatch = bloco.match(/M[eê]s:(\w{3})-(\d{2})/i);
  if (!mesMatch) return null;

  const mesAbrev = (mesMatch[1] ?? '').toLowerCase();
  const month = MESES_ABREV[mesAbrev] ?? '';
  const year = `20${mesMatch[2] ?? '00'}`;

  const conteudo = bloco.replace(/^Folha Normal\s*/i, '');
  const fields = extrairFieldsColados(conteudo);
  const bases = extrairBasesDeTexto(conteudo);

  if (fields.length === 0 && bases.length === 0) return null;

  return { page: pageNumber, year, month, fields, bases };
};

const parseFolhaNormal = (texto: string): HoleriteResult => {
  const blocos = texto.split(/(?=Folha Normal)/i).filter((b) => /M[eê]s:/i.test(b));
  const pages = blocos
    .map((bloco, index) => parseFolhaNormalBlock(bloco, index + 1))
    .filter((p): p is HoleritePage => p !== null);

  return { pages };
};

const parseDeclaracaoFieldLine = (linha: string): HoleriteField | null => {
  const matchColado = linha.match(/^(-?\d{1,3}(?:\.\d{3})*,\d{2})(\d{3})(.+)$/);
  if (matchColado) {
    return {
      code: matchColado[2] ?? '',
      label: (matchColado[3] ?? '').trim(),
      reference: '',
      value: matchColado[1] ?? '',
    };
  }

  const matchEspaco = linha.match(/^(-?\d+[,\.]\d{2})\s+(\d{3})(.+)$/);
  if (matchEspaco) {
    return {
      code: matchEspaco[2] ?? '',
      label: (matchEspaco[3] ?? '').trim(),
      reference: '',
      value: (matchEspaco[1] ?? '').replace('.', ','),
    };
  }

  return null;
};

const parseDeclaracaoBaseLine = (linha: string): HoleriteBase | null => {
  const pairs = [
    { re: /^Provisão FGTS:\s*(\d+[,\.]\d{2})/i, label: 'Provisão FGTS' },
    { re: /^Proventos Bruto:\s*(\d+[,\.]\d{2})/i, label: 'Proventos Bruto' },
    { re: /^Proventos Líquidos:\s*(-?\d+[,\.]\d{2})/i, label: 'Proventos Líquidos' },
    { re: /^Margem \(30%\):\s*(\d+[,\.]\d{2})/i, label: 'Margem (30%)' },
    { re: /^Margem \(70%\):\s*(\d+[,\.]\d{2})/i, label: 'Margem (70%)' },
  ];

  for (const pair of pairs) {
    const match = linha.match(pair.re);
    if (match) {
      return { label: pair.label, value: (match[1] ?? '').replace('.', ',') };
    }
  }

  return null;
};

const parseDeclaracaoBlockContent = (
  bloco: string,
  month: string,
  year: string,
  pageNumber: number,
): HoleritePage => {
  const fields: HoleriteField[] = [];
  const bases: HoleriteBase[] = [];
  const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const linha of linhas) {
    if (isNoiseLine(linha)) continue;

    const field = parseDeclaracaoFieldLine(linha);
    if (field) {
      fields.push(field);
      continue;
    }

    const base = parseDeclaracaoBaseLine(linha);
    if (base) {
      bases.push(base);
    }
  }

  return { page: pageNumber, year, month, fields, bases };
};

const parseDeclaracaoRemuneracao = (texto: string): HoleriteResult => {
  const competenciaRe = /M[eê]s\/Ano:MÊS(\d{2})\/(\d{4})/gi;
  const matches = [...texto.matchAll(competenciaRe)];

  if (matches.length === 0) {
    return { pages: [] };
  }

  const pages = matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? texto.length;
    const bloco = texto.slice(start, end);
    const month = match[1] ?? '01';
    const year = match[2] ?? '2000';

    return parseDeclaracaoBlockContent(bloco, month, year, index + 1);
  }).filter((p) => p.fields.length > 0 || p.bases.length > 0);

  return { pages };
};

const parseDemonstrativo = (texto: string): HoleriteResult => {
  const blocos = splitHoleriteBlocks(texto);
  const pages = blocos.map((bloco, index) => parseHoleriteBlock(bloco, index + 1));
  return { pages };
};

const RECEIPT_MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

const normalizarSemAcento = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const competenciaRecibo = (block: string): { month: string; year: string } => {
  const match = block.match(/([A-Za-z]+)\s*\/?\s*(20\d{2})\s+MENSAL/i);
  const token = normalizarSemAcento(match?.[1] ?? '');
  return { month: RECEIPT_MONTHS[token] ?? '?', year: match?.[2] ?? '?' };
};

const rotuloComIncerteza = (label: string): string => {
  const clean = label.trim().replace(/\s+/g, ' ');
  // O OCR deste layout costuma cortar a primeira letra da coluna esquerda.
  return /^(ALARIO|SR\b|EMUNERACAO|ICENCA|ESC\b|OTAL\b|IQUIDO\b)/i.test(clean)
    ? `?${clean}`
    : clean;
};

const parseReciboPagamento = (texto: string): HoleriteResult => {
  const blocks = texto.split(/(?=Recibo\s+de\s+Pagamento)/i).filter((block) => /Recibo\s+de\s+Pagamento/i.test(block));
  const pages: HoleritePage[] = [];
  const fingerprints = new Set<string>();

  for (const block of blocks) {
    const competence = competenciaRecibo(block);
    const fields: HoleriteField[] = [];
    const bases: HoleriteBase[] = [];
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      if (/^(?:OTAL|TOTAL)\s+DE\s+PROVENTOS/i.test(line)) {
        const values = [...line.matchAll(MONEY_VALUE_RE)].map((match) => match[0] ?? '');
        if (values[0]) bases.push({ label: 'Total Vencimentos', value: values[0] });
        if (values[1]) bases.push({ label: 'Total Descontos', value: values[1] });
        continue;
      }
      if (/^(?:L|I)?[IÍ]QUIDO\s+A\s+RECEBER/i.test(line)) {
        const value = line.match(MONEY_VALUE_RE)?.[0];
        if (value) bases.push({ label: 'Valor Liquido', value });
        continue;
      }
      if (/^(?:al[aá]rio|alario)\s+Base/i.test(line)) {
        const values = [...line.matchAll(MONEY_VALUE_RE)].map((match) => match[0] ?? '');
        const labels = ['?Salario Base', '?Base Contrib. INSS', '?Base Calc. FGTS', '?FGTS Mes', '?Base Calc. IRRF'];
        values.forEach((value, index) => {
          if (labels[index]) bases.push({ label: labels[index], value });
        });
        continue;
      }
      if (!/\d{1,3}(?:\.\d{3})*,\d{2}/.test(line) || /^(?:CNPJ|Fls\.?|Referencia|Proventos|Descri)/i.test(line)) continue;

      const itemRe = /([A-Z][A-Z .-]{2,}?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/g;
      let item: RegExpExecArray | null = itemRe.exec(line);
      while (item) {
        const label = rotuloComIncerteza(item[1] ?? '');
        const value = item[2] ?? '';
        if (label && value) fields.push({ code: '', label, reference: '', value });
        item = itemRe.exec(line);
      }
    }

    // O OCR pode produzir duas leituras da mesma página, com pequenas
    // diferenças apenas no cabeçalho. As verbas e valores identificam de
    // forma mais estável a duplicata do que a competência mal reconhecida.
    const fingerprint = fields.map((field) => `${field.label}-${field.value}`).join('|');
    if (fields.length === 0 || fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    pages.push({ page: pages.length + 1, year: competence.year, month: competence.month, fields, bases });
  }

  return { pages };
};

export const parseHolerite = (texto: string): HoleriteResult => {
  const normalizado = normalizarTexto(texto);

  if (/DEMONSTRATIVODEPAGAMENTOMENSAL|Período:\s*\d{2}\/\d{4}/i.test(normalizado)) {
    const demo = parseDemonstrativo(normalizado);
    if (demo.pages.length > 0) return demo;
  }

  if (/Folha Normal|M[eê]s:[a-z]{3}-\d{2}/i.test(normalizado)) {
    const folha = parseFolhaNormal(normalizado);
    if (folha.pages.length > 0) return folha;
  }

  if (/Declaração Remuneração|ValorNomeVerba/i.test(normalizado)) {
    const declaracao = parseDeclaracaoRemuneracao(normalizado);
    if (declaracao.pages.length > 0) return declaracao;
  }

  if (/Recibo\s+de\s+Pagamento/i.test(normalizado)) {
    const recibo = parseReciboPagamento(normalizado);
    if (recibo.pages.length > 0) return recibo;
  }

  return { pages: [] };
};
