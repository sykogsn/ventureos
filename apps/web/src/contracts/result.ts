export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function err<T = never>(
  code: string,
  message: string,
): ApiResult<T> {
  return { ok: false, error: { code, message } };
}
