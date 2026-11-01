import { ManagementError } from './errors';

export function text(value: string, name: string, max: number, required = true) {
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new ManagementError('validation', `Verifique ${name}.`);
  return result;
}
export function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ManagementError('validation', 'Identificador inválido.');
  return value;
}
export function amount(value: number, minimum = 0.01) {
  if (!Number.isFinite(value) || value < minimum || value > 9999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.0001) throw new ManagementError('validation', 'Indique um montante válido, com até duas casas decimais.');
  return value;
}
export function instant(value: string) {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new ManagementError('validation', 'Indique data e hora com fuso horário.');
  return new Date(value).toISOString();
}
export function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new ManagementError('validation', 'Indique uma data válida.');
  return value;
}
export function period(from: string, to: string) {
  const start = instant(from), end = instant(to);
  if (start >= end) throw new ManagementError('validation', 'O fim do período deve ser posterior ao início.');
  return { start, end };
}
