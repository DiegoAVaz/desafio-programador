import {
  CartaoPontoValue,
  HoleriteValue,
  TipoTranscricao,
  TranscricaoValue,
} from '../types/transcricao';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isPage = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1;

export const validarValue = (tipo: TipoTranscricao, value: unknown): TranscricaoValue | null => {
  if (!isObject(value) || !Array.isArray(value.pages)) return null;

  if (tipo === 'cartao-ponto') {
    const valid = value.pages.every((page) => {
      if (!isObject(page) || !isPage(page.page) || !Array.isArray(page.days)) return false;
      return page.days.every((day) => {
        if (!isObject(day) || !isString(day.date_raw) || !Array.isArray(day.punches)) return false;
        return day.punches.every((punch) =>
          isObject(punch) &&
          (punch.kind === 'IN' || punch.kind === 'OUT') &&
          isString(punch.time_raw) &&
          isString(punch.time_hhmm),
        );
      });
    });
    return valid ? value as unknown as CartaoPontoValue : null;
  }

  const valid = value.pages.every((page) => {
    if (
      !isObject(page) || !isPage(page.page) || !isString(page.year) || !isString(page.month) ||
      !Array.isArray(page.fields) || !Array.isArray(page.bases)
    ) return false;
    const fieldsValid = page.fields.every((field) =>
      isObject(field) && isString(field.code) && isString(field.label) &&
      isString(field.reference) && isString(field.value),
    );
    const basesValid = page.bases.every((base) =>
      isObject(base) && isString(base.label) && isString(base.value),
    );
    return fieldsValid && basesValid;
  });
  return valid ? value as unknown as HoleriteValue : null;
};
