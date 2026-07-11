import "server-only";

/** Vercel serverless: /var/task is read-only; only /tmp is writable (ephemeral). */
export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

/** Local dev / non-Vercel: project `data/` tree may be written. */
export function canWriteProjectDataFiles(): boolean {
  return !isVercelRuntime();
}

export function assertLocalProjectDataWriteAllowed(context: string): void {
  if (isVercelRuntime()) {
    throw new Error(
      `${context}: project data files are read-only on Vercel. Use GitHub storage for persistent state.`,
    );
  }
}
