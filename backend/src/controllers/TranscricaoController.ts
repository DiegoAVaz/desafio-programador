import { Request, Response } from 'express';
import {
  AtualizarTranscricaoUseCase,
  ConsultarTranscricaoUseCase,
  ExportarPlanilhaUseCase,
  IniciarTranscricaoUseCase,
  TranscricaoNaoConcluidaError,
  TranscricaoNaoEncontradaError,
} from '../useCases/TranscricaoUseCases';
import { FormatoPlanilha } from '../services/spreadsheetExporter';
import { validarValue } from '../services/transcricaoValidator';

export class TranscricaoController {
  constructor(
    private iniciarUseCase: IniciarTranscricaoUseCase,
    private consultarUseCase: ConsultarTranscricaoUseCase,
    private atualizarUseCase: AtualizarTranscricaoUseCase,
    private exportarUseCase: ExportarPlanilhaUseCase,
  ) {}

  async iniciarUpload(req: Request, res: Response): Promise<void> {
    const arquivo = req.file;
    const tipo = String(req.body?.tipo || '').trim();

    if (!arquivo || !arquivo.buffer || arquivo.buffer.length === 0) {
      res.status(400).json({ erro: 'Arquivo PDF obrigatório.' });
      return;
    }

    const tipoValido = tipo === 'cartao-ponto' || tipo === 'holerite';

    if (!tipoValido) {
      res.status(400).json({ erro: 'Tipo de documento inválido.' });
      return;
    }

    try {
      const id = this.iniciarUseCase.executar(tipo, arquivo);
      res.status(202).json({ id });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro ao iniciar processamento.';
      res.status(500).json({ erro: mensagem });
    }
  }

  async consultarStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ erro: 'ID inválido' });
      return;
    }

    const resultado = this.consultarUseCase.executar(id);

    if (!resultado) {
      res.status(404).json({ erro: 'Transcrição não encontrada' });
      return;
    }

    res.status(200).json(resultado);
  }

  async atualizarTranscricao(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (typeof id !== 'string' || !id.trim()) {
      res.status(400).json({ erro: 'ID inválido.' });
      return;
    }

    const atual = this.consultarUseCase.executar(id);
    if (!atual) {
      res.status(404).json({ erro: 'Transcrição não encontrada.' });
      return;
    }
    const value = validarValue(atual.tipo, req.body?.value);
    if (!value) {
      res.status(400).json({ erro: 'Payload inválido para o tipo de transcrição.' });
      return;
    }

    try {
      const resultado = this.atualizarUseCase.executar(id, value);
      res.status(200).json(resultado);
    } catch (erro) {
      if (erro instanceof TranscricaoNaoConcluidaError) {
        res.status(409).json({ erro: erro.message });
        return;
      }
      if (erro instanceof TranscricaoNaoEncontradaError) {
        res.status(404).json({ erro: erro.message });
        return;
      }
      res.status(500).json({ erro: 'Erro ao salvar as correções.' });
    }
  }

  async baixarPlanilha(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const formato = String(req.query.formato ?? 'xlsx').toLowerCase();
    if (typeof id !== 'string' || !id.trim()) {
      res.status(400).json({ erro: 'ID inválido.' });
      return;
    }
    if (!['xlsx', 'csv', 'json'].includes(formato)) {
      res.status(400).json({ erro: 'Formato inválido. Use xlsx, csv ou json.' });
      return;
    }

    try {
      const planilha = await this.exportarUseCase.executar(id, formato as FormatoPlanilha);
      res.setHeader('Content-Type', planilha.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${planilha.filename}"`);
      res.status(200).send(planilha.body);
    } catch (erro) {
      if (erro instanceof TranscricaoNaoEncontradaError) {
        res.status(404).json({ erro: erro.message });
        return;
      }
      if (erro instanceof TranscricaoNaoConcluidaError) {
        res.status(409).json({ erro: erro.message });
        return;
      }
      res.status(500).json({ erro: 'Erro ao gerar a planilha.' });
    }
  }
}
