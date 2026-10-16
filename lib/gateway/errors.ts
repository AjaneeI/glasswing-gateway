export class GatewayError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryable = false,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// Next development reloads can retain a service instance from an older module.
// Its errors remain recognizable even when the constructor identity changes.
export function isGatewayError(error: unknown): error is GatewayError {
  if (!(error instanceof Error) || error.name !== 'GatewayError') return false;
  const candidate = error as GatewayError;
  return (
    typeof candidate.code === 'string' &&
    Number.isInteger(candidate.status) &&
    candidate.status >= 400 &&
    candidate.status <= 599 &&
    typeof candidate.retryable === 'boolean'
  );
}

export function publicError(error: unknown) {
  if (isGatewayError(error))
    return { code: error.code, message: error.message, retryable: error.retryable };
  return {
    code: 'INTERNAL_ERROR',
    message: 'Gateway could not complete this operation.',
    retryable: false,
  };
}
