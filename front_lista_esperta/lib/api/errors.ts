/** Error thrown by the API helpers, carrying the HTTP status for UI decisions. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC: Record<number, string> = {
  400: "Confira os dados e tente de novo.",
  401: "Sua sessão terminou. Entre de novo.",
  403: "Sua conta não tem acesso a esta área.",
  404: "Não encontramos o que você procurava.",
  409: "Esse dado já está em uso.",
  429: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
};

/** Turns any failure into a message for the person using the app. */
export function errorMessage(error: unknown, overrides: Partial<Record<number, string>> = {}): string {
  if (error instanceof ApiError) {
    return overrides[error.status] ?? GENERIC[error.status] ?? "O servidor não respondeu como esperado. Tente de novo.";
  }
  if (error instanceof TypeError) {
    return "Não foi possível falar com o servidor. Confira sua conexão.";
  }
  return "Algo deu errado. Tente de novo.";
}

/** Unwraps an openapi-fetch result, throwing ApiError on failure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok && result.data !== undefined) return result.data;
  if (result.response.ok) return undefined as T;
  const body = result.error as { message?: string | string[] } | undefined;
  const message = Array.isArray(body?.message)
    ? body.message.join("; ")
    : (body?.message ?? result.response.statusText);
  throw new ApiError(result.response.status, message);
}
