import { TranscricaoStatus } from '../types/transcricao';
import { ITranscricaoRepository } from '../interfaces/ITranscricaoRepository';

export class TranscricaoRepository implements ITranscricaoRepository {
    private bancoDeDados: Record<string, TranscricaoStatus> = {};

    salvar(registro: TranscricaoStatus): void {
        this.bancoDeDados[registro.id] = registro;
    }

    buscarPorId(id: string): TranscricaoStatus | undefined {
        return this.bancoDeDados[id];
    }

    atualizar(id: string, mudancas: Partial<TranscricaoStatus>): boolean {
        const atual = this.bancoDeDados[id];

        if (!atual) {
            return false;
        }

        this.bancoDeDados[id] = {
            ...atual,
            ...mudancas,
        };

        return true;
    }
}
