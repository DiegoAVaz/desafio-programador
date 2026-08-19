import { TranscricaoStatus } from "../types/transcricao";

export interface ITranscricaoRepository {
    salvar(registro: TranscricaoStatus): void;
    buscarPorId(id: string): TranscricaoStatus | undefined;
    atualizar(id: string, mudancas: Partial<TranscricaoStatus>): boolean;
}