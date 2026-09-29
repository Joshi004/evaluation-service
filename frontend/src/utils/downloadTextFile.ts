// Triggers a client-side download of `content` as a file named
// `filename` -- the Leaderboard's Export CSV (§8.6 item 8: "client-side
// Blob", no server round trip) and any later page that exports a table
// the same way. A throwaway <a download> plus a Blob URL is the
// standard way to save a string as a file with no extra dependency;
// the object URL is revoked right after the click so it doesn't leak.
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
