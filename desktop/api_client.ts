import {
  API_KEY_ENV,
  API_KEY_HEADER,
  type TokenCreateInput,
  type TokenRecord,
  type TokenUpdateInput,
  type VerifyResult,
} from "../shared/mod.ts";

/** APIからのエラー応答。接続自体に失敗した場合は status: 0 */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** トークン管理APIのHTTPクライアント */
export class ApiClient {
  #baseUrl: string;
  #apiKey: string;

  constructor(
    baseUrl = Deno.env.get("API_BASE_URL") ?? "http://localhost:8000",
    apiKey = Deno.env.get(API_KEY_ENV) ?? "",
  ) {
    this.#baseUrl = baseUrl;
    this.#apiKey = apiKey;
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      // baseUrlのパス接頭辞を保つため、絶対パス解決になるnew URL(path, base)ではなく
      // 末尾スラッシュを除いたbaseへ直接結合する（例: .../timed-access + /tokens）
      const url = this.#baseUrl.replace(/\/+$/, "") + path;
      res = await fetch(url, {
        ...init,
        headers: {
          [API_KEY_HEADER]: this.#apiKey,
          ...(init.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
      });
    } catch {
      throw new ApiError(
        0,
        `APIサーバー（${this.#baseUrl}）に接続できません。` +
          "`deno task dev:api` でAPIサーバーが起動しているか確認してください",
      );
    }

    if (!res.ok) {
      const message = await res.json()
        .then((body) =>
          typeof body?.message === "string" ? body.message : undefined
        )
        .catch(() => undefined);
      throw new ApiError(
        res.status,
        message ?? `APIエラーが発生しました（HTTP ${res.status}）`,
      );
    }

    if (res.status === 204) {
      await res.body?.cancel();
      return undefined as T;
    }
    return await res.json() as T;
  }

  async listTokens(): Promise<TokenRecord[]> {
    const { tokens } = await this.#request<{ tokens: TokenRecord[] }>(
      "/tokens",
    );
    return tokens;
  }

  createToken(input: TokenCreateInput): Promise<TokenRecord> {
    return this.#request("/tokens", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getToken(site: string, id: string): Promise<TokenRecord> {
    return this.#request(
      `/tokens/${encodeURIComponent(site)}/${encodeURIComponent(id)}`,
    );
  }

  updateToken(
    site: string,
    id: string,
    input: TokenUpdateInput,
  ): Promise<TokenRecord> {
    return this.#request(
      `/tokens/${encodeURIComponent(site)}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  }

  deleteToken(site: string, id: string): Promise<void> {
    return this.#request(
      `/tokens/${encodeURIComponent(site)}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  }

  verifyToken(site: string, id: string): Promise<VerifyResult> {
    return this.#request(
      `/verify/${encodeURIComponent(site)}/${encodeURIComponent(id)}`,
    );
  }
}
