// Wraps the Clipboard API in one place so every CopyButton behaves the
// same way if a browser ever needs a fallback (e.g. an insecure
// context where navigator.clipboard is unavailable).
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
