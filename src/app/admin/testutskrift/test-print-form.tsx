"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Printer } from "lucide-react"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { BadgePreview } from "@/components/badge-preview"
import {
  AppPhaseButton,
  ConnectingPrintButton,
  PrinterConnectButton,
  PrinterMessage,
  printerBlocksPrint,
  printerNeedsConnect,
} from "@/components/printer-connect"
import { Button } from "@/components/ui/button"
import { LabelPrintError, printBadge } from "@/lib/label-printer"
import { withBadgeQr } from "@/lib/lbx-patch"
import { platformFromNavigator, printsDirect, supportsAndroidIntent } from "@/lib/platform"
import { currentPrintMethod, type PrintMethod, usePrintMethod } from "@/lib/print-method"
import {
  badgeQrGrid,
  getPrintSample,
  PRINT_SAMPLES,
  type TestPrintFormValues,
  testPrintFormSchema,
} from "@/lib/print-samples"
import {
  buildAndroidPrintIntent,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
} from "@/lib/print-url"
import { DEFAULT_PUBLIC_APP_URL } from "@/lib/public-app-url"
import {
  appLinkBusy,
  appLinkBusyLabel,
  appLinkNeedsAction,
  useAppLinkPhase,
  useLabelPrinter,
} from "@/lib/use-label-printer"
import { apiPath, cn } from "@/lib/utils"

const fieldClass =
  "h-12 w-full rounded-xl border border-white/15 bg-[var(--color-bg-base)] px-4 text-base text-[var(--color-fg-base)] outline-none focus-visible:border-[var(--color-fg-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-fg-brand)]/40"

export function TestPrintForm({ initialPrintMethod }: { initialPrintMethod: PrintMethod }) {
  const sampleIdField = useId()
  const nameId = useId()
  const line2Id = useId()
  const line3Id = useId()
  const qrId = useId()
  const qrHintId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const direct = printsDirect(usePrintMethod(initialPrintMethod))
  const printer = useLabelPrinter()
  const link = useAppLinkPhase()
  const linkAction = appLinkNeedsAction(link)
  const linkBusy = appLinkBusy(link)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TestPrintFormValues>({
    resolver: zodResolver(testPrintFormSchema),
    defaultValues: {
      sampleId: "badge",
      name: "Test Testesen",
      line2: "TDC",
      line3: "Utvikler",
      qr: DEFAULT_PUBLIC_APP_URL,
    },
  })

  const sampleId = watch("sampleId")
  const name = watch("name")
  const line2 = watch("line2")
  const line3 = watch("line3")
  const qr = watch("qr").trim()
  const sample = getPrintSample(sampleId) ?? PRINT_SAMPLES[0]!
  const isQr = sample.kind === "qr"
  const grid = isQr && qr ? badgeQrGrid(qr) : null

  async function onSubmit(values: TestPrintFormValues) {
    const chosen = getPrintSample(values.sampleId)
    if (!chosen) return

    setError(null)
    setBusy(true)
    if (printsDirect(currentPrintMethod())) {
      try {
        await printBadge({
          name: values.name,
          line2: values.line2,
          template: chosen.template,
          ...(chosen.kind === "qr" ? { qr: values.qr, line3: values.line3 } : {}),
        })
      } catch (caught) {
        setError(caught instanceof LabelPrintError ? caught.message : "Klarte ikke å skrive ut.")
      } finally {
        setBusy(false)
      }
      return
    }
    try {
      const platform = platformFromNavigator()
      const android = platform === "android" && supportsAndroidIntent()
      const fallbackUrl = `${window.location.origin}${apiPath("/admin/testutskrift")}`
      const template = await loadTemplateBase64(chosen.template)
      const input = {
        fileBase64: chosen.kind === "qr" ? withBadgeQr(template, values.qr) : template,
        paperSizeId: DEFAULT_PAPER_SIZE_ID,
        name: values.name,
        line2: values.line2,
        ...(chosen.kind === "qr" ? { line3: values.line3 } : {}),
      }
      if (android) {
        window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
      } else {
        window.location.href = buildPrintUrl(input)
      }
    } catch {
      setError("Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event)
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={sampleIdField} className="text-sm font-medium opacity-80">
          Prøve
        </label>
        <div className="relative">
          <select
            id={sampleIdField}
            className={cn(fieldClass, "appearance-none pr-10")}
            {...register("sampleId")}
          >
            {PRINT_SAMPLES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm opacity-50"
            aria-hidden
          >
            ▾
          </span>
        </div>
        {errors.sampleId ? (
          <p className="text-sm text-[var(--color-bg-danger)]">{errors.sampleId.message}</p>
        ) : null}
      </div>

      <div className="flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-6 text-center">
        {isQr ? (
          // Drawn from the dots in every mode: there is no static preview of a code typed in here.
          <BadgePreview
            name={name}
            line2={line2}
            line3={line3}
            qr={grid ? qr : null}
            template={sample.template}
          />
        ) : direct ? (
          <BadgePreview name={name} line2={line2} template={sample.template} />
        ) : sample.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- static badge preview asset
          <img
            src={apiPath(sample.preview)}
            alt=""
            width={96}
            height={96}
            className="size-24 bg-white"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-xl border border-dashed border-white/20 text-sm opacity-50">
            Kun tekst
          </div>
        )}
        <div className="max-w-sm">
          <p className="text-lg font-medium">{sample.label}</p>
          <p className="mt-1 text-sm opacity-70">{sample.description}</p>
        </div>
      </div>

      {isQr ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor={nameId} className="text-sm font-medium opacity-80">
              Navn
            </label>
            <input id={nameId} className={fieldClass} autoComplete="off" {...register("name")} />
            {errors.name ? (
              <p className="text-sm text-[var(--color-bg-danger)]">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={line2Id} className="text-sm font-medium opacity-80">
              Firma
            </label>
            <input id={line2Id} className={fieldClass} autoComplete="off" {...register("line2")} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={line3Id} className="text-sm font-medium opacity-80">
              Rolle
            </label>
            <input id={line3Id} className={fieldClass} autoComplete="off" {...register("line3")} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor={qrId} className="text-sm font-medium opacity-80">
              QR-innhold
            </label>
            <textarea
              id={qrId}
              rows={2}
              className={cn(
                fieldClass,
                "field-sizing-content h-auto min-h-12 resize-none py-3 break-all",
              )}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Lenke eller tekst"
              aria-describedby={qrHintId}
              {...register("qr")}
            />
            {errors.qr ? (
              <p id={qrHintId} className="text-sm text-[var(--color-bg-danger)]">
                {errors.qr.message}
              </p>
            ) : (
              <p id={qrHintId} className="text-sm opacity-60">
                {grid
                  ? `${grid.modules} × ${grid.modules} ruter. Kortere innhold gir større ruter, som er lettere å skanne.`
                  : qr
                    ? "For mye til QR-koden på navneskiltet."
                    : "Lenke, tekst eller hva du vil teste."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor={nameId} className="text-sm font-medium opacity-80">
              Navn
            </label>
            <input id={nameId} className={fieldClass} autoComplete="off" {...register("name")} />
            {errors.name ? (
              <p className="text-sm text-[var(--color-bg-danger)]">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={line2Id} className="text-sm font-medium opacity-80">
              Linje 2
            </label>
            <input id={line2Id} className={fieldClass} autoComplete="off" {...register("line2")} />
          </div>
        </div>
      )}

      {direct ? (
        <PrinterMessage printer={printer} error={error} />
      ) : error ? (
        <p className="text-base text-[var(--color-bg-danger)]">{error}</p>
      ) : null}

      {linkBusy ? (
        <ConnectingPrintButton label={appLinkBusyLabel(link)} />
      ) : linkAction ? (
        <AppPhaseButton phase={link} />
      ) : direct && printerNeedsConnect(printer) ? (
        <PrinterConnectButton />
      ) : (
        <Button type="submit" size="lg" disabled={busy || (direct && printerBlocksPrint(printer))}>
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <Printer className="size-5" aria-hidden />
          )}
          {busy ? (direct ? "Skriver ut…" : "Henter mal…") : "Skriv ut prøve"}
        </Button>
      )}
    </form>
  )
}
