let _pdfParse: ((buffer: Buffer) => Promise<{ text: string; numpages: number }>) | null = null;
let _tesseract: typeof import('tesseract.js') | null = null;

const tryLoadPdfParse = () => {
  if (_pdfParse) return _pdfParse;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _pdfParse = require('pdf-parse');
  } catch {
    _pdfParse = null;
  }
  return _pdfParse;
};

const tryLoadTesseract = () => {
  if (_tesseract) return _tesseract;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _tesseract = require('tesseract.js');
  } catch {
    _tesseract = null;
  }
  return _tesseract;
};

const normalizarTexto = (texto: string): string =>
  texto
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();

const textoUtil = (texto: string): boolean => {
  const limpo = texto.replace(/\s/g, '');
  if (limpo.length < 80) return false;
  return /\d{1,2}:\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|Mes\/Ano|Período:/i.test(texto);
};

const textoUtilParaExtracao = (texto: string): boolean => {
  // Alguns PDFs preservam apenas o rodapé de assinatura na camada de texto.
  // Datas e horários desse rodapé não são conteúdo suficiente para dispensar OCR.
  const semRodapes = texto
    .replace(/^.*assinado\s+eletronicamente.*$/gim, '')
    .replace(/^\s*Fls\.:.*$/gim, '')
    .replace(/^\s*ID\..*$/gim, '');

  return textoUtil(semRodapes);
};

const rasterizarPdfParaImagens = async (buffer: Buffer): Promise<Buffer[]> => {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('@napi-rs/canvas');

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const imagens: Buffer[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;

      imagens.push(canvas.toBuffer('image/png'));
    }

    return imagens;
  } catch {
    return [];
  }
};

const ocrImagens = async (imagens: Buffer[]): Promise<string> => {
  const TesseractLocal = tryLoadTesseract();
  if (!TesseractLocal || imagens.length === 0) return '';

  const textos: string[] = [];

  for (let index = 0; index < imagens.length; index += 1) {
    const imagem = imagens[index];
    if (!imagem) continue;
    try {
      const resultado = await TesseractLocal.recognize(imagem, 'por', {
        logger: () => undefined,
      });
      if (resultado.data.text) {
        // O texto de cada página precisa continuar identificável pelos parsers.
        // Em formulários em grade, juntar tudo sem limite mistura linhas de
        // páginas diferentes e torna a revisão impossível de auditar.
        textos.push(`--- OCR PAGE ${index + 1} ---\n${resultado.data.text}`);
      }
    } catch {
      // ignora página com falha de OCR
    }
  }

  return normalizarTexto(textos.join('\n\n'));
};

export const extrairTextoDoPdf = async (buffer: Buffer): Promise<string> => {
  const pdfParseLocal = tryLoadPdfParse();
  let texto = '';

  if (pdfParseLocal) {
    try {
      const resultado = await pdfParseLocal(buffer);
      texto = normalizarTexto(resultado.text || '');
    } catch {
      texto = '';
    }
  }

  if (textoUtilParaExtracao(texto)) {
    return texto;
  }

  const imagens = await rasterizarPdfParaImagens(buffer);
  const textoOcr = await ocrImagens(imagens);

  if (textoUtilParaExtracao(textoOcr)) {
    return textoOcr;
  }

  return texto || textoOcr;
};
