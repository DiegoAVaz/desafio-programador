import { parseCartaoPonto } from './parsers/cartaoPontoParser';
import { parseHolerite } from './parsers/holeriteParser';
import { extrairTextoDoPdf } from './pdfTextExtractor';

export type TipoDocumento = 'cartao-ponto' | 'holerite';

const limparValorMonetario = (valor: string): string => {
  const apenasNumeros = valor.replace(/[^\d,.-]/g, '').trim();
  if (!apenasNumeros) return '';
  return apenasNumeros.replace('.', '').replace(',', '.');
};

export const processarArquivo = async (tipo: TipoDocumento, buffer: Buffer) => {
  const texto = await extrairTextoDoPdf(buffer);

  if (!texto) {
    throw new Error('Não foi possível extrair texto do PDF. O documento pode estar corrompido ou ser uma imagem sem OCR disponível.');
  }

  if (tipo === 'cartao-ponto') {
    const resultado = parseCartaoPonto(texto);

    if (resultado.pages.length === 0 || resultado.pages.every((p) => p.days.length === 0)) {
      throw new Error('Nenhum registro de cartão de ponto foi identificado neste layout de documento.');
    }

    return resultado;
  }

  const resultado = parseHolerite(texto);

  if (resultado.pages.length === 0) {
    throw new Error('Nenhum holerite foi identificado neste layout de documento.');
  }

  return resultado;
};

export const toBrasilianMoney = (valor: string): string => {
  const numero = limparValorMonetario(valor);
  if (!numero) return '0,00';

  const [inteiroRaw, decimalRaw] = numero.split('.');
  const inteiro = inteiroRaw ?? '0';
  const decimal = decimalRaw ? decimalRaw.padEnd(2, '0').slice(0, 2) : '00';
  const inteiroFormatado = Number.parseInt(inteiro, 10).toLocaleString('pt-BR');
  return `${inteiroFormatado},${decimal}`;
};
