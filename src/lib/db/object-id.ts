import { customType } from "drizzle-orm/sqlite-core"
import { customAlphabet } from "nanoid"

/**
 * Prefixed public ids (Stripe / Ditto style).
 * App + API see `prefix_BODY`; SQLite stores only `BODY`.
 *
 * @see https://github.com/Asamsig/ditto/blob/main/OBJECT_ID.md
 * @see https://www.unkey.com/blog/uuid-ux
 */

/** Uppercase, no 0/O/1/I — readable aloud and easy to type. */
export const OBJECT_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

export const OBJECT_ID_BODY_LENGTH = 16

const objectIdPrefixes = {
  /** Printer (inventory row; the front setup sticker links to it). */
  prt: "prt",
  /** Door login token (the sticker under the printer). */
  lgn: "lgn",
  /** Attendee added by hand at the door (Manuell innsjekk); not a Checkin ticket. */
  man: "man",
} as const

export type ObjectIdPrefix = keyof typeof objectIdPrefixes

export type ObjectId<TPrefix extends ObjectIdPrefix = ObjectIdPrefix> =
  `${(typeof objectIdPrefixes)[TPrefix]}_${string}`

const createBody = customAlphabet(OBJECT_ID_ALPHABET, OBJECT_ID_BODY_LENGTH)

const bodyPattern = new RegExp(`^[${OBJECT_ID_ALPHABET}]{${OBJECT_ID_BODY_LENGTH}}$`)

export function createObjectId<TPrefix extends ObjectIdPrefix>(prefix: TPrefix): ObjectId<TPrefix> {
  return `${objectIdPrefixes[prefix]}_${createBody()}` as ObjectId<TPrefix>
}

export function objectIdBody(value: string, prefix: ObjectIdPrefix): string {
  const label = objectIdPrefixes[prefix]
  return value.replace(new RegExp(`^${label}_`, "i"), "").toUpperCase()
}

export function formatObjectId<TPrefix extends ObjectIdPrefix>(
  prefix: TPrefix,
  body: string,
): ObjectId<TPrefix> {
  return `${objectIdPrefixes[prefix]}_${body.toUpperCase()}` as ObjectId<TPrefix>
}

export function isObjectIdBody(value: string): boolean {
  return bodyPattern.test(value)
}

/**
 * Drizzle column: ser/der the presentation prefix at the DB boundary.
 *
 * Values that are not a body for this prefix (e.g. admin usernames on a
 * shared `username` column) pass through unchanged.
 */
export function objectId<TPrefix extends ObjectIdPrefix>(columnName: string, prefix: TPrefix) {
  const label = objectIdPrefixes[prefix]
  const prefixPattern = new RegExp(`^${label}_`, "i")

  return customType<{ data: string; driverData: string }>({
    dataType() {
      return "text"
    },
    toDriver(value: string) {
      if (prefixPattern.test(value)) {
        return value.replace(prefixPattern, "").toUpperCase()
      }
      if (isObjectIdBody(value)) return value.toUpperCase()
      return value
    },
    fromDriver(value: unknown) {
      const raw = String(value)
      if (prefixPattern.test(raw)) return raw
      if (isObjectIdBody(raw)) return formatObjectId(prefix, raw)
      return raw
    },
  })(columnName)
}
