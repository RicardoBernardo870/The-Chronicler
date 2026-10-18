// Error hygiene for edge functions (BC-02 scope 4): 500 bodies never carry
// internal error text. Details are logged server-side under a request id the
// client can quote.
export const internalErrorBody = (
  context: string,
  err: unknown,
): { error: string; requestId: string } => {
  const requestId = crypto.randomUUID()
  console.error(`[${requestId}] ${context}:`, err)
  return { error: "Internal server error", requestId }
}
