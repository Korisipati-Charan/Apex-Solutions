export async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrencyLimit: number
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex++;
      results[taskIndex] = await tasks[taskIndex]();
    }
  }

  const workerCount = Math.min(Math.max(1, concurrencyLimit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      if (attempt >= retries) throw err;

      const message = err instanceof Error ? err.message : String(err);
      if (/401|403|404|not[_ ]found|model .*not found|invalid model|api key|unauthorized|forbidden/i.test(message)) {
        throw err;
      }
      const isRateLimited = /429|rate.?limit/i.test(message);
      const jitter = Math.random() * 200;
      const backoffDelay =
        (isRateLimited ? delayMs * 2 : delayMs) * Math.pow(backoffFactor, attempt - 1) + jitter;

      console.warn(
        `[LLM Router] Request failed (Attempt ${attempt}/${retries}). Retrying in ${Math.round(backoffDelay)}ms due to: ${message}`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error("Execution failed after maximum retries.");
}
