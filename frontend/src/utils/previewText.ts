// Collapses runs of whitespace to a single space and trims. Every
// output_preview on run-13 literally begins with "\n\n" -- rendered raw
// in a clamped one-line cell, that reads as an empty row. The untouched
// text still matters, so it stays visible verbatim on the sample detail
// page; this just keeps a table cell readable.
export function previewText(preview: string): string {
  return preview.replace(/\s+/g, ' ').trim()
}
