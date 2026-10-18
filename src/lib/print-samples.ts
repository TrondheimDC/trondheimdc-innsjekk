import { z } from "zod"
import { BADGE_QR_MAX_DOTS } from "@/lib/badge-qr-layout"
import { labelQrGrid } from "@/lib/label-qr"

/** Admin test-print samples (DK-11208 templates). */
export const printSampleSchema = z.object({
  id: z.string(),
  /** `badge`: name + line 2. `qr`: the badge with a QR code of whatever is typed in, plus line 3. */
  kind: z.enum(["badge", "qr"]),
  label: z.string(),
  description: z.string(),
  template: z.string(),
  preview: z.string().nullable(),
})

export type PrintSample = z.infer<typeof printSampleSchema>

export const PRINT_SAMPLES: PrintSample[] = [
  {
    id: "badge",
    kind: "badge",
    label: "Navneskilt",
    description: "Produksjonsmalen — and med raster i nedre høyre hjørne.",
    template: "badge.lbx",
    preview: "/badge/8bit-duck-dither-preview.png",
  },
  {
    id: "duck-mono",
    kind: "badge",
    label: "Navneskilt med and (heldekkende)",
    description: "Sort silhuett i nedre høyre hjørne — teksten beholder full plass.",
    template: "badge-duck-mono.lbx",
    preview: "/badge/8bit-duck-mono-preview.png",
  },
  {
    id: "badge-plain",
    kind: "badge",
    label: "Navneskilt uten and",
    description: "Bare navn og linje 2.",
    template: "badge-plain.lbx",
    preview: null,
  },
  {
    id: "badge-qr",
    kind: "qr",
    label: "Navneskilt med QR",
    description: "QR nede til venstre, firma og rolle i midten, and i hjørnet.",
    template: "badge.lbx",
    preview: null,
  },
]

export const printSampleIds = PRINT_SAMPLES.map((s) => s.id) as [string, ...string[]]

export const testPrintFormSchema = z
  .object({
    sampleId: z.enum(printSampleIds),
    name: z.string().trim().min(1, "Skriv inn et navn."),
    line2: z.string().trim(),
    /** Role, under the company, on `qr` samples. */
    line3: z.string().trim(),
    /** QR content for `qr` samples; text, a link, anything. */
    qr: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (getPrintSample(values.sampleId)?.kind !== "qr") return
    if (!values.qr) {
      ctx.addIssue({
        code: "custom",
        path: ["qr"],
        message: "Skriv inn hva QR-koden skal inneholde.",
      })
    } else if (!badgeQrGrid(values.qr)) {
      ctx.addIssue({
        code: "custom",
        path: ["qr"],
        message: "For mye til QR-koden på navneskiltet.",
      })
    }
  })

export type TestPrintFormValues = z.infer<typeof testPrintFormSchema>

export function getPrintSample(id: string): PrintSample | undefined {
  return PRINT_SAMPLES.find((s) => s.id === id)
}

/** Grid of the badge QR for `data`; `null` when it is too much to scan at badge size. */
export function badgeQrGrid(data: string) {
  return labelQrGrid(data, { maxDots: BADGE_QR_MAX_DOTS, wordmark: false })
}
