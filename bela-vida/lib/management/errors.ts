export type ErrorCode = 'unauthenticated' | 'forbidden' | 'validation' | 'conflict' | 'network' | 'unsupported' | 'unknown';

export class ManagementError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManagementError';
    this.code = code;
  }
}

export function managementError(error: unknown): ManagementError {
  if (error instanceof ManagementError) return error;
  const value = error as { code?: string; status?: number; message?: string } | null;
  if (value?.status === 401 || value?.code === 'PGRST301') return new ManagementError('unauthenticated', 'A sessão terminou. Inicie sessão novamente.');
  if (value?.status === 403 || value?.code === '42501') return new ManagementError('forbidden', 'Não tem permissão para esta operação.');
  if (['23505', '23P01'].includes(value?.code ?? '')) return new ManagementError('conflict', 'Já existe um registo ou reserva que impede esta operação.');
  if (value?.code === '23514' || value?.code === '22P02') return new ManagementError('validation', 'Verifique os dados introduzidos.');
  if (value?.code === 'P0001') return new ManagementError('conflict', 'A operação não foi aceite. Actualize os dados e verifique o estado, o horário e as permissões.');
  if (error instanceof TypeError || /fetch|network|timeout/i.test(value?.message ?? '')) return new ManagementError('network', 'Não foi possível contactar o serviço. Tente novamente.');
  return new ManagementError('unknown', 'Não foi possível concluir a operação. Tente novamente.');
}

export async function execute<T>(operation: () => PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  try {
    const result = await operation();
    if (result.error) throw result.error;
    if (result.data === null || result.data === undefined) throw new ManagementError('unknown', 'O serviço não devolveu o resultado esperado.');
    return result.data as NonNullable<T>;
  } catch (error) {
    throw managementError(error);
  }
}

export async function executeVoid(operation: () => PromiseLike<{ error: unknown }>): Promise<void> {
  try {
    const result = await operation();
    if (result.error) throw result.error;
  } catch (error) { throw managementError(error); }
}
