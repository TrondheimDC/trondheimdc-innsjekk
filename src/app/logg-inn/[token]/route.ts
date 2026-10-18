import { LOGIN_TOKEN_PATTERN, printerLoginPath } from "@/lib/public-app-url"
import { apiPath } from "@/lib/utils"

/** Login sticker link (`printerStickerLoginPath`, `/logg-inn/lgn_…`) → PIN for that printer. */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!LOGIN_TOKEN_PATTERN.test(token)) return new Response(null, { status: 404 })
  // Relative, so it stays on whatever host the phone used (request.url can be the bind address).
  return new Response(null, {
    status: 307,
    headers: { Location: apiPath(printerLoginPath(token)) },
  })
}
