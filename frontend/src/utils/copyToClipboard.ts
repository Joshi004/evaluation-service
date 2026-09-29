// Wraps the Clipboard API in one place so every copy action behaves
// the same way if a browser ever needs a fallback (e.g. an insecure
// context where navigator.clipboard is unavailable). Promoted from
// CopyButton's own helper once CopyLinkButton became a second caller
// (.cursor/rules/frontend-components.mdc: logic used by two components
// belongs in src/utils/, not duplicated in each component's helper).
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
