import { FROM_PARAM } from "@/lib/attendee-path"
import type { PhonePlatform } from "@/lib/platform"

const RESULT_KEYS = new Set(["result", "errorcode"])
const IOS_PENDING_KEY = "tdc-print-pending"
/** Exactly what a successful iOS print's callback comes back as. */
export const IOS_PREDICTED_SUCCESS_QUERY = "result=SUCCESS&errorcode=SUCCESS"

/** Smooth Print reports the outcome in "result" and its own "errorcode" — casing is its own. */
export function readPrintOutcome(): string | null {
  let outcome: string | null = null
  for (const [key, value] of new URLSearchParams(window.location.search)) {
    if (RESULT_KEYS.has(key.toLowerCase())) outcome = value
  }
  return outcome
}

function stripPrintOutcomeParams() {
  const params = new URLSearchParams(window.location.search)
  for (const key of [...params.keys()]) {
    if (RESULT_KEYS.has(key.toLowerCase())) params.delete(key)
  }
  const query = params.toString()
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  )
}

/**
 * The query a print callback comes back to, before Smooth Print's result: only `fra`, so the
 * attendee screen still leads back to the search. Ends in "&" when not empty.
 */
export function printCallbackQueryPrefix(): string {
  const from = new URLSearchParams(window.location.search).get(FROM_PARAM)
  return from ? `${new URLSearchParams({ [FROM_PARAM]: from })}&` : ""
}

/**
 * iOS only. Safari reuses the open tab for a callback URL only when that URL
 * matches the address bar. Rewrite to the predicted success shape before firing.
 */
export function primeForIosTabReuse() {
  window.sessionStorage.setItem(IOS_PENDING_KEY, "1")
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}?${printCallbackQueryPrefix()}${IOS_PREDICTED_SUCCESS_QUERY}`,
  )
}

/**
 * Consume Smooth Print callback query params once per page load.
 * Returns null when there is nothing to consume (or an iOS pre-set that was
 * never actually called back).
 */
export function consumePrintOutcome(platform: PhonePlatform): {
  success: boolean
} | null {
  const outcome = readPrintOutcome()
  if (outcome == null) return null

  const isSuccess = outcome === "" || outcome.toUpperCase().includes("SUCCESS")

  if (platform === "ios" && isSuccess) {
    const wasPending = window.sessionStorage.getItem(IOS_PENDING_KEY) === "1"
    window.sessionStorage.removeItem(IOS_PENDING_KEY)
    if (!wasPending) return null
  }

  stripPrintOutcomeParams()
  return { success: isSuccess }
}
