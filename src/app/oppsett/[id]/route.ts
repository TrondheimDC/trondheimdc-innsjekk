import { PRINTER_ID_PATTERN, printerSetupPath } from "@/lib/printer-setup"
import { apiPath } from "@/lib/utils"

/** Front sticker link (`printerStickerSetupPath`, `/oppsett/prt_…`) → setup for that printer. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!PRINTER_ID_PATTERN.test(id)) return new Response(null, { status: 404 })
  // Relative, so it stays on whatever host the phone used (request.url can be the bind address).
  return new Response(null, {
    status: 307,
    headers: { Location: apiPath(printerSetupPath(id)) },
  })
}
