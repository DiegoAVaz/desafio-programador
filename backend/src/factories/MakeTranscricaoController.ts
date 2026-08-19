import { TranscricaoController } from '../controllers/TranscricaoController';
import {
  AtualizarTranscricaoUseCase,
  ConsultarTranscricaoUseCase,
  ExportarPlanilhaUseCase,
  IniciarTranscricaoUseCase,
} from '../useCases/TranscricaoUseCases';
import { TranscricaoRepository } from '../repositories/TranscricaoRepository';

export const makeTranscricaoController = (): TranscricaoController => {
  const repository = new TranscricaoRepository();

  const iniciarUseCase = new IniciarTranscricaoUseCase(repository);
  const consultarUseCase = new ConsultarTranscricaoUseCase(repository);
  const atualizarUseCase = new AtualizarTranscricaoUseCase(repository);
  const exportarUseCase = new ExportarPlanilhaUseCase(repository);

  const controller = new TranscricaoController(iniciarUseCase, consultarUseCase, atualizarUseCase, exportarUseCase);

  return controller;
};
