export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  NOT_NULL_VIOLATION: '23502',
  FOREIGN_KEY_VIOLATION: '23503',
} as const;

export interface PostgresDriverError {
  code?: string;
  constraint?: string;
  cause?: PostgresDriverError;
}

export function getPgErrorInfo(error: unknown): {
  code?: string;
  constraint?: string;
} {
  const err = error as PostgresDriverError;
  return {
    code: err?.code ?? err?.cause?.code,
    constraint: err?.constraint ?? err?.cause?.constraint,
  };
}
