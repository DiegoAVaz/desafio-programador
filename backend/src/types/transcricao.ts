export type TipoTranscricao = 'cartao-ponto' | 'holerite';
export type StatusProcessamento = 'processando' | 'concluido' | 'erro';

export interface Batida {
    kind: 'IN' | 'OUT';
    time_raw: string;
    time_hhmm: string;
}

export interface DiaCartaoPonto {
    date_raw: string;
    punches: Batida[];
}

export interface PaginaCartaoPonto {
    page: number;
    days: DiaCartaoPonto[];
}

export interface CartaoPontoValue {
    pages: PaginaCartaoPonto[];
}

export interface VerbaHolerite {
    code: string;
    label: string;
    reference: string;
    value: string;
}

export interface BaseHolerite {
    label: string;
    value: string;
}

export interface PaginaHolerite {
    page: number;
    year: string;
    month: string;
    fields: VerbaHolerite[];
    bases: BaseHolerite[];
}

export interface HoleriteValue {
    pages: PaginaHolerite[];
}

export type TranscricaoValue = CartaoPontoValue | HoleriteValue;

export interface TranscricaoStatus {
    id: string;
    tipo: TipoTranscricao;
    status: StatusProcessamento;
    erro: string | null;
    value: TranscricaoValue | null;
}
