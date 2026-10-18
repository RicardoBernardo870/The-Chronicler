export const manualJwtDecode = (authHeader: string | null): string | null => {
  if (!authHeader) return null
  const jwt = authHeader.replace(/^Bearer\s+/i, "")
  const parts = jwt.split(".")
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(atob(parts[1]))
    return typeof payload?.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}
