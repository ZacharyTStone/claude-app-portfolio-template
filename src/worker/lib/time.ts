/** What `work` resolves to, or undefined if it hasn't within `timeoutMs`.
    Work that fails in time rejects as it would on its own. Work still
    running when the time is up is left to run: a model call can't be taken
    back (and is paid for), and if it fails later, no one is waiting to
    hear. */
export async function withinTime<T>(work: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  // Once the time is up nothing awaits `work`, so a failure after that
  // would be an unhandled rejection without this.
  work.catch(() => {});
  let timer: number | null = null;
  const timeUp = new Promise<undefined>((resolve) => (timer = setTimeout(resolve, timeoutMs)));
  try {
    return await Promise.race([work, timeUp]);
  } finally {
    clearTimeout(timer);
  }
}
