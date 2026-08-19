const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const EXEMPLOS = path.resolve(__dirname, '..', '..', 'exemplos');
const FILES = ['payroll-01.pdf', 'payroll-02.pdf', 'payroll-03.pdf', 'payroll-04.pdf'];

const MONEY = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
const COMPETENCE_PATTERNS = [
  { name: 'MM/YYYY', re: /\b(0?[1-9]|1[0-2])\s*\/\s*(20\d{2}|19\d{2})\b/g },
  { name: 'YYYY-MM', re: /\b(20\d{2}|19\d{2})[-/](0?[1-9]|1[0-2])\b/g },
  { name: 'MES ANO PT', re: /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[/\s-]*\s*(20\d{2}|19\d{2})/gi },
  { name: 'COMPETENCIA', re: /compet[eê]ncia\s*:?\s*([^\n]{3,40})/gi },
  { name: 'REFERENCIA', re: /refer[eê]ncia\s*:?\s*([^\n]{3,40})/gi },
];

const BASE_KEYWORDS = /base\s*(inss|ir|fgts|prev)|total\s*(venc|descont)|valor\s*l[ií]quido|fgts\s*(do\s*m[eê]s|depositado)?|l[ií]quido\s*a\s*receber|sal[aá]rio\s*contratual/i;
const FIELD_HEADER = /c[oó]digo|verba|descri[cç][aã]o|provento|desconto|vencimento|refer[eê]ncia|qtde|qtd/i;

function heuristicScanned(buffer, textLen, numpages) {
  const raw = buffer.toString('latin1');
  const hasFont = /\/Font\b|\/Type\s*\/Font/.test(raw);
  const hasTextOps = /\bTj\b|\bTJ\b|\b'\s*\w/.test(raw);
  const hasImage = /\/Subtype\s*\/Image|\/XObject.*\/Image/.test(raw);
  const charsPerPage = numpages ? textLen / numpages : textLen;
  let verdict = 'text_layer';
  let reason = [];
  if (textLen < 80) {
    verdict = 'likely_scanned_or_empty_text';
    reason.push('text length < 80');
  } else if (charsPerPage < 150 && hasImage) {
    verdict = 'mixed_or_weak_text';
    reason.push('low chars/page with images');
  }
  if (!hasTextOps && textLen < 500) {
    verdict = 'likely_scanned_or_empty_text';
    reason.push('no Tj/TJ operators with little text');
  }
  return { verdict, hasFont, hasTextOps, hasImage, charsPerPage: Math.round(charsPerPage), reason };
}

function findCompetence(text) {
  const hits = [];
  for (const p of COMPETENCE_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ pattern: p.name, match: m[0].trim(), groups: m.slice(1) });
      if (hits.length > 8) break;
    }
  }
  return hits.slice(0, 8);
}

function classifyLines(text) {
  const lines = text.replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  const fieldCandidates = [];
  const baseCandidates = [];
  const headerLines = [];

  for (const line of lines) {
    if (FIELD_HEADER.test(line) && line.length < 120) headerLines.push(line);
    const money = line.match(MONEY);
    if (!money) continue;

    if (BASE_KEYWORDS.test(line)) {
      baseCandidates.push(line);
      continue;
    }

    if (/^\d{3,4}\s+/.test(line) || /\b\d{3,4}\s+[A-Za-zÀ-ú]/.test(line)) {
      fieldCandidates.push(line);
      continue;
    }

    const m = line.match(/^(\d{3,4})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/);
    if (m) fieldCandidates.push(line);
  }

  return { lines, headerLines: headerLines.slice(0, 6), fieldCandidates, baseCandidates };
}

function detectSections(text) {
  const lower = text.toLowerCase();
  const markers = [];
  const keys = [
    'vencimentos', 'descontos', 'proventos', 'base inss', 'base ir', 'fgts', 'valor liquido', 'valor líquido',
    'total vencimentos', 'total descontos', 'demonstrativo', 'recibo de pagamento', 'holerite', 'contracheque',
    'código', 'codigo', 'descrição', 'descricao', 'referência', 'referencia'
  ];
  for (const k of keys) {
    const idx = lower.indexOf(k);
    if (idx >= 0) markers.push({ keyword: k, index: idx });
  }
  markers.sort((a, b) => a.index - b.index);
  return markers.slice(0, 15);
}

async function analyzeFile(name) {
  const filePath = path.join(EXEMPLOS, name);
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  const text = (data.text || '').replace(/\u00a0/g, ' ');
  const scanned = heuristicScanned(buffer, text.length, data.numpages);
  const classified = classifyLines(text);
  const competence = findCompetence(text);
  const sections = detectSections(text);

  return {
    file: name,
    fileSizeBytes: buffer.length,
    pages: data.numpages,
    textLength: text.length,
    lineCount: classified.lines.length,
    scannedAnalysis: scanned,
    competenceHits: competence,
    sectionMarkers: sections,
    sampleHeaders: classified.headerLines,
    sampleFieldLines: classified.fieldCandidates.slice(0, 12),
    sampleBaseLines: classified.baseCandidates.slice(0, 12),
    allFieldCount: classified.fieldCandidates.length,
    allBaseCount: classified.baseCandidates.length,
    textPreview: text.slice(0, 1500),
    textTail: text.slice(-800),
  };
}

(async () => {
  const results = [];
  for (const f of FILES) {
    try {
      results.push(await analyzeFile(f));
    } catch (e) {
      results.push({ file: f, error: String(e) });
    }
  }
  const out = JSON.stringify({ analyzedAt: new Date().toISOString(), results }, null, 2);
  fs.writeFileSync(path.join(__dirname, 'payroll-analysis-output.json'), out, 'utf8');
})();
