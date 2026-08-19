export interface CartaoPunch {
  kind: 'IN' | 'OUT';
  time_raw: string;
  time_hhmm: string;
}

export interface CartaoDia {
  date_raw: string;
  punches: CartaoPunch[];
}

export interface CartaoPage {
  page: number;
  days: CartaoDia[];
}

export interface CartaoPontoResult {
  pages: CartaoPage[];
}

const MES_ANO_RE = /M[eê]s\/Ano\s*:\s*(\d{1,2})\s*\/\s*(\d{4})/i;
const DAY_LINE_RE = /^\s*(\d{1,2})\s*-\s*(DOM|SEG|TER|QUA|QUI|SEX|SAB|SÁB|FER)\b/i;
const BB_DAY_LINE_RE = /^\s*(\d{1,2})\s*(DOM|SEG|TER|QUA|QUI|SEX|SAB|SÁB|FER)(?:\b|\s|—|-)/i;
const GENERIC_DATE_RE = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
const OCCURRENCE_MARKERS = /(?:HE-|HE\s+COMPENSADA|DESTACAMENTO|REG\.|ABN\/)/i;
const TIME_RE = /\b(\d{1,2}:\d{2})\b/g;

const normalizarTexto = (texto: string): string =>
  texto
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();

const normalizeTime = (valor: string): string => {
  const match = valor.match(/(\d{1,2}):(\d{2})/);
  if (!match) return valor;

  const hh = match[1] ?? '00';
  const mm = match[2] ?? '00';
  return `${hh.padStart(2, '0')}:${mm}`;
};

const montarDateRaw = (dia: string, mes: string, ano: string): string => {
  const diaFmt = dia.padStart(2, '0');
  const mesFmt = mes.padStart(2, '0');
  const anoFmt = ano.length === 2 ? `20${ano}` : ano;
  return `${diaFmt}/${mesFmt}/${anoFmt}`;
};

const isNoiseLine = (linha: string): boolean => {
  if (!linha.trim()) return true;

  const checks = [
    /assinado\s+eletronicamente/i,
    /^ID\./i,
    /^Fls\.:/i,
    /n[uú]mero\s+do\s+(processo|documento)/i,
    /F\s*O\s*L\s*H\s*A/i,
    /\bSIPON\b/i,
    /\bPOEL\b/i,
    /^Dia\s+Semana/i,
  ];

  return checks.some((re) => re.test(linha));
};

const isAssinaturaDateLine = (linha: string): boolean =>
  /assinado\s+eletronicamente/i.test(linha)
  || /^ID\./i.test(linha)
  || /^Fls\.:/i.test(linha)
  || /^Data:\s*\d/i.test(linha)
  || /^Emissão:/i.test(linha)
  || /Cartão de Ponto Página/i.test(linha);

const extractPunchTimes = (linha: string, skipJornada = false): string[] => {
  let trecho = linha;
  const markerMatch = trecho.match(OCCURRENCE_MARKERS);
  if (markerMatch?.index !== undefined) {
    trecho = trecho.slice(0, markerMatch.index);
  }

  const times = [...trecho.matchAll(TIME_RE)].map((match) => match[1] ?? '').filter(Boolean);
  const filtrados = times.filter((time) => !/^00:\d{2}$/.test(time));

  if (skipJornada && filtrados.length > 0) {
    return filtrados.slice(1);
  }

  return filtrados;
};

const appendPunches = (dia: CartaoDia, times: string[]): void => {
  for (const timeRaw of times) {
    const kind: 'IN' | 'OUT' = dia.punches.length % 2 === 0 ? 'IN' : 'OUT';
    dia.punches.push({
      kind,
      time_raw: timeRaw,
      time_hhmm: normalizeTime(timeRaw),
    });
  }
};

const criarDia = (dayNum: string, mes: string, ano: string, linha: string): CartaoDia => {
  const dia: CartaoDia = {
    date_raw: montarDateRaw(dayNum, mes, ano),
    punches: [],
  };
  appendPunches(dia, extractPunchTimes(linha, true));
  return dia;
};

const parseSiponBlock = (content: string, mes: string, ano: string): CartaoDia[] => {
  const dias: CartaoDia[] = [];
  let diaAberto: CartaoDia | null = null;

  const linhas = content
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);

  for (const linha of linhas) {
    if (isNoiseLine(linha)) continue;

    const dayMatch = linha.match(DAY_LINE_RE);
    if (dayMatch) {
      const dayNum = dayMatch[1] ?? '';
      const novoDia = criarDia(dayNum, mes, ano, linha);
      dias.push(novoDia);
      diaAberto = novoDia;
      continue;
    }

    if (diaAberto && /\b\d{1,2}:\d{2}\b/.test(linha)) {
      appendPunches(diaAberto, extractPunchTimes(linha, false));
    }
  }

  return dias;
};

const parseSipon = (texto: string): CartaoPage[] => {
  if (!/F\s*O\s*L\s*H\s*A|\bSIPON\b|\bPOEL\b/i.test(texto)) {
    return [];
  }

  const blocos = splitMesAnoBlocks(texto);
  if (blocos.length === 0) return [];

  return blocos.map((bloco, index) => ({
    page: index + 1,
    days: parseSiponBlock(bloco.content, bloco.mes, bloco.ano),
  }));
};

const fixTimeToken = (token: string): string | null => {
  const trimmed = token.trim();
  const withColon = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (withColon) {
    return normalizeTime(`${withColon[1]}:${withColon[2]}`);
  }

  const fourDigit = trimmed.match(/^(\d{2})(\d{2})$/);
  if (fourDigit) {
    return normalizeTime(`${fourDigit[1]}:${fourDigit[2]}`);
  }

  return null;
};

const extractBancoBrasilTimes = (linha: string): string[] => {
  const times: string[] = [];
  const rangeRe = /(\d{1,2}:\d{2}|\d{4})\s*-\s*(\d{1,2}:\d{2}|\d{4})/g;
  let match: RegExpExecArray | null = rangeRe.exec(linha);

  while (match) {
    const entrada = fixTimeToken(match[1] ?? '');
    const saida = fixTimeToken(match[2] ?? '');
    if (entrada) times.push(entrada);
    if (saida) times.push(saida);
    match = rangeRe.exec(linha);
  }

  return times;
};

const parseBancoBrasilBlock = (content: string, mes: string, ano: string): CartaoDia[] => {
  const dias: CartaoDia[] = [];

  const linhas = content
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);

  for (const linha of linhas) {
    if (isNoiseLine(linha)) continue;

    const dayMatch = linha.match(BB_DAY_LINE_RE);
    if (!dayMatch) continue;

    const dayNum = dayMatch[1] ?? '';
    const times = extractBancoBrasilTimes(linha);
    const punches: CartaoPunch[] = times.map((timeRaw, index) => ({
      kind: index % 2 === 0 ? 'IN' : 'OUT',
      time_raw: timeRaw,
      time_hhmm: normalizeTime(timeRaw),
    }));

    dias.push({
      date_raw: montarDateRaw(dayNum, mes, ano),
      punches,
    });
  }

  return dias;
};

const isBancoBrasilLayout = (texto: string): boolean =>
  /PONTO\s+ELETR[ÔO]NICO|Relat[óo]rio\s+Mensal|BANCO\s+DO\s+BRASIL/i.test(texto);

const parseBancoBrasil = (texto: string): CartaoPage[] => {
  const blocos = splitMesAnoBlocks(texto);
  if (blocos.length === 0) return [];

  return blocos.map((bloco, index) => ({
    page: index + 1,
    days: parseBancoBrasilBlock(bloco.content, bloco.mes, bloco.ano),
  }));
};

const splitMesAnoBlocks = (texto: string): Array<{ mes: string; ano: string; content: string }> => {
  const regex = new RegExp(MES_ANO_RE.source, 'gi');
  const matches = [...texto.matchAll(regex)];

  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextMatch = matches[index + 1];
    const end = nextMatch?.index ?? texto.length;
    return {
      mes: match[1] ?? '01',
      ano: match[2] ?? '2000',
      content: texto.slice(start, end),
    };
  });
};

const parseGenericFallback = (texto: string): CartaoPage[] => {
  const dias: CartaoDia[] = [];

  const linhas = normalizarTexto(texto)
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);

  for (const linha of linhas) {
    if (isNoiseLine(linha) || isAssinaturaDateLine(linha)) continue;

    const dateMatch = linha.match(GENERIC_DATE_RE);
    if (!dateMatch) continue;

    const dia = dateMatch[1] ?? '01';
    const mes = dateMatch[2] ?? '01';
    const ano = dateMatch[3] ?? '2000';
    const cartaoDia: CartaoDia = {
      date_raw: montarDateRaw(dia, mes, ano),
      punches: [],
    };
    appendPunches(cartaoDia, extractPunchTimes(linha, false));
    dias.push(cartaoDia);
  }

  if (dias.length === 0) {
    return [];
  }

  return [{ page: 1, days: dias }];
};

const FULL_DATE_LINE_RE = /^(\d{2}\/\d{2}\/\d{4})\s*[—\-]?\s*(SEG|TER|QUA|QUI|SEX|SAB|DOM)\b/im;
const EVENT_MARKER_RE = /\b(ABONO|NATAL|CONFRATERNIZ|FERIADO|ATESTADO|PAIX|INCONFID|ANIVERS|CORPUS|TRABALHADOR|ASSUN|INDEPEND)\b/i;

const extractCartaoCompletoTimes = (trecho: string): string[] => {
  const antesPipe = trecho.split('|')[0] ?? trecho;
  // Depois do evento ficam colunas auxiliares (abono, hora extra, atraso
  // etc.). Elas não representam batidas e não podem ser promovidas a IN/OUT.
  const antesOcorrencia = antesPipe.split(EVENT_MARKER_RE)[0] ?? antesPipe;

  const times: string[] = [];

  // O relatório usa sufixos c/d após o horário. Ambos pertencem à batida;
  // ignorar o c desloca as colunas e transforma uma saída em entrada.
  const withSuffix = [...antesOcorrencia.matchAll(/(\+?\d{1,2}:\d{2})[cd]\b/gi)];
  if (withSuffix.length > 0) {
    for (const match of withSuffix) {
      if (match[1]) times.push(match[1]);
    }
    return times;
  }

  const nextDay = [...antesOcorrencia.matchAll(/\+(\d{1,2}:\d{2})d?\b/gi)];
  const normal = [...antesOcorrencia.matchAll(/\b(\d{1,2}:\d{2})\b/gi)];

  for (const match of normal) {
    if (match[1]) times.push(match[1]);
  }
  for (const match of nextDay) {
    if (match[1]) times.push(`+${match[1]}`);
  }

  return times;
};

const parseCartaoDataCompleta = (texto: string): CartaoPage[] => {
  const blocos = texto.split(/(?=Cart[aã]o de Ponto P[aá]gina\s+\d+)/i);
  const pages: CartaoPage[] = [];

  blocos.forEach((bloco, index) => {
    const dias: CartaoDia[] = [];
    const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const linha of linhas) {
      if (isNoiseLine(linha) || isAssinaturaDateLine(linha)) continue;

      const dayMatch = linha.match(FULL_DATE_LINE_RE);
      if (!dayMatch) continue;

      const dateRaw = dayMatch[1] ?? '';
      const resto = linha.slice(dayMatch[0].length);
      const times = extractCartaoCompletoTimes(resto);
      const punches: CartaoPunch[] = times.map((timeRaw, punchIndex) => ({
        kind: punchIndex % 2 === 0 ? 'IN' : 'OUT',
        time_raw: timeRaw,
        time_hhmm: normalizeTime(timeRaw),
      }));

      dias.push({ date_raw: dateRaw, punches });
    }

    if (dias.length > 0) {
      const pageMatch = bloco.match(/Cart[aã]o de Ponto P[aá]gina\s+(\d+)/i);
      pages.push({
        page: pageMatch ? parseInt(pageMatch[1] ?? String(index + 1), 10) : index + 1,
        days: dias,
      });
    }
  });

  if (pages.length === 0) {
    const dias: CartaoDia[] = [];
    const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const linha of linhas) {
      if (isNoiseLine(linha) || isAssinaturaDateLine(linha)) continue;
      const dayMatch = linha.match(FULL_DATE_LINE_RE);
      if (!dayMatch) continue;

      const times = extractCartaoCompletoTimes(linha.slice(dayMatch[0].length));
      dias.push({
        date_raw: dayMatch[1] ?? '',
        punches: times.map((timeRaw, punchIndex) => ({
          kind: punchIndex % 2 === 0 ? 'IN' : 'OUT',
          time_raw: timeRaw,
          time_hhmm: normalizeTime(timeRaw),
        })),
      });
    }

    if (dias.length > 0) {
      pages.push({ page: 1, days: dias });
    }
  }

  return pages;
};

const isCartaoDataCompletaLayout = (texto: string): boolean => {
  const temCabecalho = /Cart[aã]o de Ponto|Entl.*Sai|Ent\d.*Sai/i.test(texto);
  const temLinhasComData = /^\d{2}\/\d{2}\/\d{4}\s+[—\-]?\s*(SEG|TER|QUA|QUI|SEX|SAB|DOM)\b/im.test(texto);
  return (temCabecalho || temLinhasComData) && FULL_DATE_LINE_RE.test(texto);
};

/**
 * Formulários quinzenais preenchidos à mão (como o time-card-04) são uma
 * grade, não uma lista de texto. O OCR comum perde boa parte das linhas e não
 * fornece coordenadas aqui, portanto este fallback só aproveita evidências
 * locais: o número impresso do dia e tokens de horário presentes na mesma
 * linha. Nunca completa mês, ano ou dígitos que não foram lidos.
 */
const OCR_PAGE_MARKER_RE = /^---\s*OCR\s+PAGE\s+(\d+)\s*---$/im;

const splitOcrPages = (texto: string): Array<{ page: number; content: string }> => {
  const markerRe = new RegExp(OCR_PAGE_MARKER_RE.source, 'gim');
  const matches = [...texto.matchAll(markerRe)];
  if (matches.length === 0) return [{ page: 1, content: texto }];

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? texto.length;
    return {
      page: Number.parseInt(match[1] ?? String(index + 1), 10),
      content: texto.slice(start, end),
    };
  });
};

const normalizarOcrAscii = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const GRID_HEADER_RE = /(?:\bquinzena\b|\bmanha\b|\btarde\b|\bextra\b|intervalo\s+p\/?\s*refei)/i;
const GRID_COLUMN_RE = /(?:entrada|envada|entada).*(?:saida|saia|saica).*(?:entrada|envada|entada).*(?:saida|saia|saica)/i;

const isHandwrittenGridDocument = (pages: Array<{ content: string }>): boolean => {
  const normalized = pages.map(({ content }) => normalizarOcrAscii(content));
  return normalized.some((content) => GRID_HEADER_RE.test(content))
    && normalized.some((content) => GRID_COLUMN_RE.test(content));
};

const monthYearFromGridHeader = (content: string): { month: string; year: string } => {
  // Só aceita o valor quando o rótulo e todos os dígitos foram reconhecidos.
  // Uma anotação manuscrita parcialmente lida deve permanecer auditável como ?.
  const normalized = normalizarOcrAscii(content);
  const month = normalized.match(/mes\s*[:.]?\s*(0[1-9]|1[0-2])\b/i)?.[1] ?? '??';
  const year = normalized.match(/ano\s*[:.]?\s*(20\d{2})\b/i)?.[1] ?? '????';
  return { month, year };
};

const extractGridTimeTokens = (line: string): string[] => {
  const tokens = line.match(/(?<![\dA-Za-z])(?:[\dA-Za-z?]{1,2}):(?:[\dA-Za-z?]{2})(?![\dA-Za-z])/g) ?? [];
  const result: string[] = [];

  for (const token of tokens) {
    const [hourRaw = '', minuteRaw = ''] = token.split(':');
    const raw = `${hourRaw}:${minuteRaw}`;
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
      result.push(raw);
      continue;
    }

    // A posição do caractere é preservada, mas letras/símbolos não são
    // "corrigidos" para números. O operador poderá revisar o ? no PDF.
    const uncertain = `${hourRaw.replace(/\D/g, '?')}:${minuteRaw.replace(/\D/g, '?')}`;
    if (/^[\d?]{1,2}:[\d?]{2}$/.test(uncertain) && uncertain.includes('?')) {
      result.push(uncertain);
    }
  }

  return result.slice(0, 6);
};

const parseHandwrittenGridPage = (content: string, page: number): CartaoPage => {
  const { month, year } = monthYearFromGridHeader(content);
  const days: CartaoDia[] = [];
  const seenDays = new Set<string>();

  for (const rawLine of content.split('\n')) {
    // O dia é o índice impresso na primeira coluna; exigir delimitador evita
    // transformar horários/valores do corpo em novos dias.
    const match = rawLine.match(/^\s*[\[\](){}|]*\s*(\d{1,2})(?=\s*(?:[\]|).,;]|\s{2,}|$))/);
    const dayNumber = match?.[1];
    if (!dayNumber) continue;

    const day = Number.parseInt(dayNumber, 10);
    if (day < 1 || day > 31 || seenDays.has(dayNumber)) continue;
    seenDays.add(dayNumber);

    days.push({
      date_raw: `${dayNumber.padStart(2, '0')}/${month}/${year}`,
      // A leitura dos horários manuscritos não é confiável. Deixá-los vazios
      // permite a correção manual sem publicar números que o OCR apenas parece
      // ter lido.
      punches: [],
    });
  }

  return { page, days };
};

const parseHandwrittenGrid = (texto: string): CartaoPage[] => {
  const ocrPages = splitOcrPages(texto);
  if (!isHandwrittenGridDocument(ocrPages)) return [];

  const pages = ocrPages.map(({ page, content }) => parseHandwrittenGridPage(content, page));
  return pages.some((page) => page.days.length > 0) ? pages : [];
};

export const parseCartaoPonto = (texto: string): CartaoPontoResult => {
  const normalizado = normalizarTexto(texto);

  if (isBancoBrasilLayout(normalizado)) {
    const bbPages = parseBancoBrasil(normalizado);
    if (bbPages.some((p) => p.days.length > 0)) {
      return { pages: bbPages };
    }
  }

  const siponPages = parseSipon(normalizado);
  if (siponPages.some((p) => p.days.length > 0)) {
    return { pages: siponPages };
  }

  if (isCartaoDataCompletaLayout(normalizado)) {
    const completoPages = parseCartaoDataCompleta(normalizado);
    if (completoPages.some((p) => p.days.length > 0)) {
      return { pages: completoPages };
    }
  }

  const fallbackPages = parseGenericFallback(normalizado);
  return { pages: fallbackPages };
};
