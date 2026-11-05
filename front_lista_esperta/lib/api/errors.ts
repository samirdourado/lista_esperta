/** Error thrown by the API helpers, carrying the HTTP status for UI decisions. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Parsed error body, e.g. { code: "POSSIBLE_DUPLICATE", storeId }. */
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Machine-readable reason sent by the API, when there is one. */
  get code(): string | undefined {
    return typeof this.body.code === "string" ? this.body.code : undefined;
  }
}

const GENERIC: Record<number, string> = {
  400: "Confira os dados e tente de novo.",
  401: "Sua sessão terminou. Entre de novo.",
  403: "Sua conta não tem acesso a esta área.",
  404: "Não encontramos o que você procurava.",
  409: "Esse dado já está em uso.",
  429: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  503: "Um serviço que usamos não respondeu. Tente de novo em instantes.",
};

const BY_CODE: Record<string, string> = {
  INVALID_CNPJ: "Esse CNPJ não é válido. Confira os números.",
  CNPJ_NOT_FOUND: "Não encontramos esse CNPJ na Receita Federal.",
  CNPJ_NOT_ACTIVE: "Esse CNPJ não está ativo na Receita Federal.",
  CNPJ_TAKEN: "Outra loja já usa esse CNPJ. Se ela é sua, peça para administrá-la.",
  CNPJ_SERVICE_UNAVAILABLE: "A consulta de CNPJ não respondeu agora. Tente de novo em instantes.",
  ALREADY_MEMBER: "Você já administra essa loja.",
  UNKNOWN_CATEGORY: "Escolha categorias da lista.",
};

/** Turns any failure into a message for the person using the app. */
/** Message for a code sent by the API (e.g. verificationError), if known. */
export function codeMessage(code: string | null | undefined): string | undefined {
  return code ? BY_CODE[code] : undefined;
}

export function errorMessage(error: unknown, overrides: Partial<Record<number, string>> = {}): string {
  if (error instanceof ApiError) {
    if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
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
  throw new ApiError(result.response.status, message, (result.error ?? {}) as Record<string, unknown>);
}
