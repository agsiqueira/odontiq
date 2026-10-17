export type NavigatorHttpAttempt = {
  attempt: number;
  status?: number;
  outcome: "success" | "http-error" | "network-error";
  durationMs: number;
  retryable: boolean;
};

/** Only explicit transient gateway responses are retried. Never retries application validation. */
export async function fetchNavigatorWithGatewayRetry(
  url: string,
  init: RequestInit,
  onAttempt: (attempt: NavigatorHttpAttempt) => void,
  dependencies: { fetch?: typeof fetch; wait?: (ms: number) => Promise<void> } = {},
): Promise<{ response: Response; attempts: NavigatorHttpAttempt[] }> {
  const request = dependencies.fetch ?? fetch;
  const wait = dependencies.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const attempts: NavigatorHttpAttempt[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    let response: Response;
    try {
      response = await request(url, init);
    } catch (error) {
      const record: NavigatorHttpAttempt = { attempt, outcome: "network-error", durationMs: Date.now() - started, retryable: false };
      attempts.push(record);
      onAttempt(record);
      throw error;
    }
    const retryable = [502, 503, 504].includes(response.status);
    const record: NavigatorHttpAttempt = { attempt, status: response.status, outcome: response.ok ? "success" : "http-error", durationMs: Date.now() - started, retryable };
    attempts.push(record);
    onAttempt(record);
    if (!retryable || attempt === 2 || init.signal?.aborted) return { response, attempts };
    await response.body?.cancel();
    await wait(250);
  }
  throw new Error("Navigator retry limit reached");
}
