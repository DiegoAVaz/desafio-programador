import { randomUUID } from 'crypto';
import { ITranscricaoRepository } from '../interfaces/ITranscricaoRepository';
import { TranscricaoStatus, TranscricaoValue } from '../types/transcricao';
import { processarArquivo, TipoDocumento } from '../services/pdfProcessor';
import { exportarPlanilha, FormatoPlanilha, PlanilhaExportada } from '../services/spreadsheetExporter';

export class TranscricaoNaoEncontradaError extends Error {}
export class TranscricaoNaoConcluidaError extends Error {}

export class IniciarTranscricaoUseCase {
  constructor(private transcricaoRepository: ITranscricaoRepository) {}

  executar(tipo: TipoDocumento, arquivo: Express.Multer.File): string {
    const id = randomUUID();

    const novoRegistro: TranscricaoStatus = {
      id,
      tipo,
      status: 'processando',
      erro: null,
      value: null,
    };

    this.transcricaoRepository.salvar(novoRegistro);

    void this.processarEmBackground(id, tipo, arquivo.buffer);

    return id;
  }

  private async processarEmBackground(id: string, tipo: TipoDocumento, buffer: Buffer): Promise<void> {
    try {
      const value = await processarArquivo(tipo, buffer);
      this.transcricaoRepository.atualizar(id, {
        status: 'concluido',
        erro: null,
        value,
      });
    } catch (erro) {
      this.transcricaoRepository.atualizar(id, {
        status: 'erro',
        erro: erro instanceof Error ? erro.message : 'Erro ao processar o documento.',
        value: null,
      });
    }
  }
}

export class ConsultarTranscricaoUseCase {
  constructor(private transcricaoRepository: ITranscricaoRepository) {}

  executar(id: string): TranscricaoStatus | null {
    const registro = this.transcricaoRepository.buscarPorId(id);

    if (!registro) return null;

    return registro;
  }
}

export class AtualizarTranscricaoUseCase {
  constructor(private transcricaoRepository: ITranscricaoRepository) {}

  executar(id: string, value: TranscricaoValue): TranscricaoStatus {
    const registro = this.transcricaoRepository.buscarPorId(id);
    if (!registro) throw new TranscricaoNaoEncontradaError('Transcrição não encontrada.');
    if (registro.status !== 'concluido') {
      throw new TranscricaoNaoConcluidaError('A transcrição só pode ser alterada após a conclusão do processamento.');
    }
    this.transcricaoRepository.atualizar(id, { value });
    return this.transcricaoRepository.buscarPorId(id)!;
  }
}

export class ExportarPlanilhaUseCase {
  constructor(private transcricaoRepository: ITranscricaoRepository) {}

  async executar(id: string, formato: FormatoPlanilha): Promise<PlanilhaExportada> {
    const registro = this.transcricaoRepository.buscarPorId(id);
    if (!registro) throw new TranscricaoNaoEncontradaError('Transcrição não encontrada.');
    if (registro.status !== 'concluido' || !registro.value) {
      throw new TranscricaoNaoConcluidaError('A planilha está disponível somente para transcrições concluídas.');
    }
    return exportarPlanilha(registro.tipo, registro.value, formato);
  }
}
