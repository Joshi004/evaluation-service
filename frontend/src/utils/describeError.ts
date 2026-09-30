// The message half of RegisterModelPage.helper.ts's own
// describeRegistrationError pattern, pulled out as a shared utility:
// an ApiError's message is already the backend's own detail text (see
// api/client.ts), and a plain Error's message is usually just as
// readable -- either way, that is the string worth showing inline or
// in a toast. String(error) also "works", but for an Error it renders
// as "Error: <message>" (or "ApiError: <message>"), leaking the class
// name into visible copy. Kept out of only the ErrorState "Details"
// disclosures on purpose: those want the raw error, not this shortened
// form.
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
