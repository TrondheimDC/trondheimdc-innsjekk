/** `fra=sok`: the attendee screen leads back to the search, not the scanner. */
export const FROM_PARAM = "fra"
/** `skriv-ut=1`: print and check in on arrival (Manuell innsjekk). Dropped once it starts. */
export const PRINT_NOW_PARAM = "skriv-ut"

export function attendeePath(
  id: string,
  { fromSearch = false, printNow = false }: { fromSearch?: boolean; printNow?: boolean } = {},
): string {
  const params = new URLSearchParams()
  if (fromSearch) params.set(FROM_PARAM, "sok")
  if (printNow) params.set(PRINT_NOW_PARAM, "1")
  const query = params.toString()
  return `/deltaker/${encodeURIComponent(id)}${query ? `?${query}` : ""}`
}
