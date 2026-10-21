import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { nonEmptyText, optionalText, requiredText } from "@/lib/non-empty-string"
import { formatBluetoothMac, isCompleteBluetoothMac } from "@/lib/printer-format"
import { DEFAULT_PRINTER_MODEL, printerModelIdSchema } from "@/lib/printer-models"
import { objectId } from "./object-id"

export * from "./auth-schema"

export const attendees = sqliteTable("attendees", {
  id: text("id").primaryKey(),
  /** Null until known: a ticket nobody filled out has no name; the door asks for it. */
  name: nonEmptyText("name"),
  company: nonEmptyText("company"),
  role: nonEmptyText("role"),
  /** Bedrift on a ticket nobody filled out: prefilled when the door types in the name. */
  companySuggestion: nonEmptyText("company_suggestion"),
  /** ISO timestamp of the current check-in. Null when not checked in. */
  checkedInAt: text("checked_in_at"),
  /** Soft-delete when missing from a later import. Null while active. */
  deletedAt: text("deleted_at"),
  /** Door corrections, used as-is while `correctedAt` is set; a re-import never touches these. */
  nameOverride: nonEmptyText("name_override"),
  companyOverride: nonEmptyText("company_override"),
  roleOverride: nonEmptyText("role_override"),
  /** ISO timestamp of the latest correction. Null when the badge prints as imported. */
  correctedAt: text("corrected_at"),
  /** `manual`: added at the door (`man_…`), so a later import leaves the row alone. */
  source: text("source", { enum: ["import", "manual"] })
    .notNull()
    .default("import"),
})

export const checkEvents = sqliteTable(
  "check_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attendeeId: text("attendee_id")
      .notNull()
      .references(() => attendees.id),
    action: text("action", { enum: ["create", "in", "out", "correct"] }).notNull(),
    createdAt: text("created_at").notNull(),
    /** JSON `{ from, to }` of name/company/role for `correct`; `{ to, reason }` for `create`. */
    detail: text("detail"),
    /** better-auth user id (printer door account or admin) that performed the action. */
    actorUserId: text("actor_user_id"),
    /** Denormalized actor name for readable history. */
    actorName: text("actor_name"),
  },
  (table) => ({
    attendeeIdx: index("check_events_attendee_idx").on(table.attendeeId),
    actorIdx: index("check_events_actor_idx").on(table.actorUserId),
  }),
)

/** What the door sees: name/company/role already carry any correction. */
export const attendeeSchema = createSelectSchema(attendees).omit({
  nameOverride: true,
  companyOverride: true,
  roleOverride: true,
})
export type Attendee = z.infer<typeof attendeeSchema>
/** A row from the Checkin CSV — corrections are never part of an import. */
export type ImportedAttendee = Pick<
  typeof attendees.$inferInsert,
  "id" | "name" | "company" | "companySuggestion" | "role" | "checkedInAt" | "deletedAt"
>

export const attendeesSearchResponseSchema = z.object({
  attendees: z.array(attendeeSchema),
})

export const attendeeResponseSchema = z.object({
  attendee: attendeeSchema,
})

export const attendeesSearchQuerySchema = z.object({
  q: z.string().trim().max(200),
  includeCheckedIn: z.boolean(),
})

export const attendeeStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  checkedIn: z.number().int().nonnegative(),
  /** Badges printed with a door correction. */
  corrected: z.number().int().nonnegative(),
})

export const setCheckedInBodySchema = z.object({
  checkedIn: z.boolean(),
})

/** Door correction form + PUT body. Company and role may be blanked on purpose. */
export const correctAttendeeBodySchema = z.object({
  name: requiredText({ max: 200, error: "Skriv inn et navn." }),
  company: optionalText({ max: 200 }),
  role: optionalText({ max: 200 }),
})
export type CorrectAttendeeBody = z.output<typeof correctAttendeeBodySchema>
export type CorrectAttendeeInput = z.input<typeof correctAttendeeBodySchema>

/** Manuell innsjekk form + POST body: someone not on the Checkin list, typed in at the door. */
export const manualAttendeeBodySchema = correctAttendeeBodySchema.extend({
  /** Why they are not on the list ("foredragsholder", "billett ikke funnet"). Optional. */
  reason: optionalText({ max: 200 }),
})
export type ManualAttendeeBody = z.output<typeof manualAttendeeBodySchema>
export type ManualAttendeeInput = z.input<typeof manualAttendeeBodySchema>

/** Admin audit row: a manual attendee and the login that added it. */
export const manualAttendeeSchema = attendeeSchema.extend({
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  reason: z.string().nullable(),
})
export type ManualAttendee = z.infer<typeof manualAttendeeSchema>

export const printers = sqliteTable("printers", {
  /** App: `prt_BODY` (the setup sticker links to it); SQLite: body only. Older rows are UUIDs. */
  id: objectId("id", "prt").primaryKey(),
  name: text("name").notNull(),
  /** Bluetooth MAC, or an IP when connectType is WiFi. */
  address: text("address").notNull(),
  serial: text("serial").notNull().default(""),
  model: text("model").notNull().default(DEFAULT_PRINTER_MODEL),
  connectType: text("connect_type").notNull().default("BT"),
  createdAt: text("created_at").notNull(),
})

export const printerSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  serial: z.string(),
  model: printerModelIdSchema.or(z.string()),
  connectType: z.enum(["BT", "WiFi"]),
  createdAt: z.string(),
  /** Door login shadow user (better-auth). Null only for legacy rows. */
  userId: z.string().nullable(),
  banned: z.boolean().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
})
export type Printer = z.infer<typeof printerSchema>

export const printersResponseSchema = z.object({
  printers: z.array(printerSchema),
})

export const printerResponseSchema = z.object({
  printer: printerSchema,
})

export const printerSecretsSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
  token: z.string().min(1),
})

export const printerCreateResponseSchema = printerResponseSchema.merge(printerSecretsSchema)

export const printerPatchResponseSchema = printerResponseSchema.extend({
  pin: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  token: z.string().min(1).optional(),
})

export const printerBodySchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    address: z.string().trim().max(80),
    serial: z.string().trim().toUpperCase().max(40).default(""),
    model: printerModelIdSchema.default(DEFAULT_PRINTER_MODEL),
    connectType: z.enum(["BT", "WiFi"]).default("BT"),
    validFrom: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .min(1)
        .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Ugyldig dato" })
        .optional(),
    ),
    validTo: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .min(1)
        .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Ugyldig dato" })
        .optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.connectType === "WiFi") {
      if (!data.address) {
        ctx.addIssue({ code: "custom", path: ["address"], message: "Skriv inn adressen" })
      }
    } else if (!isCompleteBluetoothMac(formatBluetoothMac(data.address))) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Skriv en full MAC, som 00:1B:A9:00:00:00",
      })
    }
    if (
      data.validFrom != null &&
      data.validTo != null &&
      Date.parse(data.validTo) <= Date.parse(data.validFrom)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Sluttdato må være etter startdato",
      })
    }
  })
  .transform((data) => ({
    ...data,
    address: data.connectType === "BT" ? formatBluetoothMac(data.address) : data.address,
  }))

export const printerUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    validFrom: z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Ugyldig dato" })
      .nullable()
      .optional(),
    validTo: z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Ugyldig dato" })
      .nullable()
      .optional(),
    banned: z.boolean().optional(),
    rotatePin: z.boolean().optional(),
    rotateToken: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.validFrom != null &&
      data.validTo != null &&
      Date.parse(data.validTo) <= Date.parse(data.validFrom)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Sluttdato må være etter startdato",
      })
    }
  })

/** Admin form: name + door-login validity. Empty date fields clear the bound. */
export const printerEditBodySchema = z
  .object({
    name: z.string().trim().min(1, "Skriv inn et navn").max(40),
    validFrom: z.string(),
    validTo: z.string(),
  })
  .superRefine((data, ctx) => {
    const from = data.validFrom.trim()
    const to = data.validTo.trim()
    if (from && Number.isNaN(Date.parse(from))) {
      ctx.addIssue({ code: "custom", path: ["validFrom"], message: "Ugyldig dato" })
    }
    if (to && Number.isNaN(Date.parse(to))) {
      ctx.addIssue({ code: "custom", path: ["validTo"], message: "Ugyldig dato" })
    }
    if (from && to && Date.parse(to) <= Date.parse(from)) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Sluttdato må være etter startdato",
      })
    }
  })
  .transform((data) => ({
    name: data.name.trim(),
    validFrom: data.validFrom.trim() ? new Date(data.validFrom.trim()).toISOString() : null,
    validTo: data.validTo.trim() ? new Date(data.validTo.trim()).toISOString() : null,
  }))

export const smoothPrintApks = sqliteTable(
  "smooth_print_apks",
  {
    id: text("id").primaryKey(),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    versionLabel: text("version_label").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    byteSize: integer("byte_size").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    activeIdx: index("smooth_print_apks_active_idx").on(table.active),
  }),
)

export const smoothPrintApkSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  storedName: z.string(),
  versionLabel: z.string(),
  active: z.boolean(),
  byteSize: z.number().int().nonnegative(),
  createdAt: z.string(),
})

/**
 * An upload as admin and the door see it. `app` is read from the APK, not stored: true for
 * TDC Innsjekk, false for Smooth Print. The active one decides how Android phones check in.
 */
export const smoothPrintApkItemSchema = smoothPrintApkSchema.extend({ app: z.boolean() })
export type SmoothPrintApk = z.infer<typeof smoothPrintApkItemSchema>

export const smoothPrintApksResponseSchema = z.object({
  apks: z.array(smoothPrintApkItemSchema),
})

export const smoothPrintApkResponseSchema = z.object({
  apk: smoothPrintApkItemSchema,
})

export const smoothPrintApkUploadSchema = z.object({
  versionLabel: z.string().trim().max(80).default(""),
})

export const smoothPrintApkPatchSchema = z.object({
  active: z.boolean(),
})
