"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Copy, Eye, EyeOff, Link2, Pencil, QrCode, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useId, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PrinterModelMeta, PrinterModelThumb } from "@/components/admin/printer-model"
import { RemovePrinterButton } from "@/components/admin/remove-printer"
import { PrintStickerButton, ShowStickerQrButton, StickerPreview } from "@/components/admin/sticker"
import { StickerIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { isWithinValidityWindow } from "@/lib/auth-validity"
import { toDatetimeLocalValue } from "@/lib/datetime-local"
import { type Printer, printerEditBodySchema } from "@/lib/db/schema"
import {
  fetchPrinterSecrets,
  fetchPrinters,
  patchPrinter,
  printersQueryKey,
} from "@/lib/printer-queries"
import { printerStickerSetupPath } from "@/lib/printer-setup"
import { loginStickerText, printerLoginUrl } from "@/lib/public-app-url"
import { apiPath } from "@/lib/utils"

function formatValidity(from: string | null, to: string | null) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    )
  if (!from && !to) return "Ingen begrensning"
  if (from && to) return `${fmt(from)} – ${fmt(to)}`
  if (from) return `Fra ${fmt(from)}`
  return `Til ${fmt(to!)}`
}

function statusLabel(printer: Printer): { label: string; tone: "ok" | "warn" | "off" } {
  if (printer.banned) return { label: "Deaktivert", tone: "off" }
  if (!isWithinValidityWindow(printer.validFrom, printer.validTo)) {
    return { label: "Utenfor periode", tone: "warn" }
  }
  return { label: "Aktiv", tone: "ok" }
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="surface"
      disabled={!url}
      onClick={async () => {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      <Link2 className="size-5" aria-hidden />
      {copied ? "Kopiert" : "Kopier lenke"}
    </Button>
  )
}

function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="surface"
      disabled={!token}
      onClick={async () => {
        await navigator.clipboard.writeText(token)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      <Copy className="size-5" aria-hidden />
      {copied ? "Kode kopiert" : "Kopier kode"}
    </Button>
  )
}

function RevealPin({ pin }: { pin: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-3xl tracking-[0.35em] tabular-nums">
        {visible ? pin : "••••••"}
      </p>
      <Button type="button" variant="surface" onClick={() => setVisible((v) => !v)}>
        {visible ? (
          <EyeOff className="size-5" aria-hidden />
        ) : (
          <Eye className="size-5" aria-hidden />
        )}
        {visible ? "Skjul PIN" : "Vis PIN"}
      </Button>
    </div>
  )
}

function LoginSecretsButton({
  id,
  name,
  origin,
  secrets,
  onLoaded,
  label = "PIN og innlogging",
  className,
}: {
  id: string
  name: string
  origin: string
  secrets?: { pin?: string; token?: string }
  onLoaded: (result: { pin: string; token: string }) => void
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const load = useMutation({
    mutationFn: () => fetchPrinterSecrets(id),
    onSuccess: (result) => {
      onLoaded(result)
      setOpen(true)
    },
    onError: () => {
      toast.error("Klarte ikke å hente PIN og QR.")
    },
  })

  const loginUrl = secrets?.token && origin ? printerLoginUrl(origin, secrets.token) : ""

  return (
    <>
      <Button
        type="button"
        variant="surface"
        className={className}
        disabled={load.isPending}
        onClick={() => (secrets?.token ? setOpen(true) : load.mutate())}
      >
        <QrCode className="size-5" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{name}</DialogTitle>
          <div className="mt-4 flex flex-col items-center gap-3">
            {secrets?.pin ? <RevealPin pin={secrets.pin} /> : null}
            {loginUrl ? (
              <>
                <StickerPreview name={loginStickerText(name)} url={loginUrl} variant="login" />
                <PrintStickerButton
                  name={loginStickerText(name)}
                  url={loginUrl}
                  fallbackPath="/admin/printers"
                  templateFile="stasjon.lbx"
                />
                {secrets?.token ? <CopyTokenButton token={secrets.token} /> : null}
                <CopyLinkButton url={loginUrl} />
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PrinterCardActions({
  printer,
  origin,
  secrets,
  onSecrets,
}: {
  printer: Printer
  origin: string
  secrets?: { pin?: string; token?: string }
  onSecrets: (result: { pin?: string; token?: string }) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const setupUrl = `${origin}${apiPath(printerStickerSetupPath(printer.id))}`
  const banned = Boolean(printer.banned)
  const dayOfButtonClass =
    "h-auto min-h-14 w-full flex-col gap-1 bg-black/25 py-3 text-base whitespace-normal"

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <ShowStickerQrButton name={printer.name} url={setupUrl} className={dayOfButtonClass} />
        <LoginSecretsButton
          id={printer.id}
          name={printer.name}
          origin={origin}
          secrets={secrets}
          className={dayOfButtonClass}
          onLoaded={(result) => onSecrets(result)}
        />
      </div>

      {banned ? (
        <DeactivatePrinterButton id={printer.id} name={printer.name} banned={banned} />
      ) : null}

      <Button
        type="button"
        variant="ghost"
        className="justify-between opacity-80"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        {moreOpen ? "Skjul" : "Mer"}
        <ChevronDown
          className={`size-5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </Button>

      {moreOpen ? (
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          <EditPrinterButton printer={printer} />
          <RotatePinButton id={printer.id} name={printer.name} onRotated={onSecrets} />
          <RotateQrButton id={printer.id} name={printer.name} onRotated={onSecrets} />
          {!banned ? (
            <DeactivatePrinterButton id={printer.id} name={printer.name} banned={banned} />
          ) : null}
          <RemovePrinterButton id={printer.id} name={printer.name} />
        </div>
      ) : null}
    </div>
  )
}

function EditPrinterButton({ printer }: { printer: Printer }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const nameId = useId()
  const fromId = useId()
  const toId = useId()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<
    z.input<typeof printerEditBodySchema>,
    unknown,
    z.output<typeof printerEditBodySchema>
  >({
    resolver: zodResolver(printerEditBodySchema),
    defaultValues: {
      name: printer.name,
      validFrom: toDatetimeLocalValue(printer.validFrom),
      validTo: toDatetimeLocalValue(printer.validTo),
    },
  })

  const save = useMutation({
    mutationFn: (body: z.output<typeof printerEditBodySchema>) => patchPrinter(printer.id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: printersQueryKey })
      const previous = queryClient.getQueryData<Printer[]>(printersQueryKey)
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) =>
        current?.map((item) =>
          item.id === printer.id
            ? {
                ...item,
                name: body.name,
                validFrom: body.validFrom,
                validTo: body.validTo,
              }
            : item,
        ),
      )
      return { previous }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) =>
        current?.map((item) => (item.id === printer.id ? result.printer : item)),
      )
      setOpen(false)
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(printersQueryKey, context.previous)
      toast.error("Klarte ikke å lagre endringene.")
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: printersQueryKey })
    },
  })

  function clearBounds() {
    setValue("validFrom", "", { shouldDirty: true })
    setValue("validTo", "", { shouldDirty: true })
  }

  return (
    <>
      <Button
        type="button"
        variant="surface"
        className="justify-start bg-black/20"
        onClick={() => {
          reset({
            name: printer.name,
            validFrom: toDatetimeLocalValue(printer.validFrom),
            validTo: toDatetimeLocalValue(printer.validTo),
          })
          setOpen(true)
        }}
      >
        <Pencil className="size-5" aria-hidden />
        Endre
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Endre printer</DialogTitle>
          <DialogDescription>
            Dørinnlogging virker bare innenfor perioden. Tomme datofelt = ingen begrensning.
          </DialogDescription>
          <form className="mt-4" onSubmit={handleSubmit((data) => save.mutate(data))}>
            <FieldGroup className="gap-4">
              <Field data-invalid={Boolean(errors.name) || undefined}>
                <FieldLabel htmlFor={nameId}>Navn</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={nameId}
                    {...register("name")}
                    placeholder="Inngang A"
                    aria-invalid={Boolean(errors.name)}
                  />
                </InputGroup>
                <FieldError
                  className="text-[var(--color-bg-danger)]"
                  errors={errors.name ? [errors.name] : undefined}
                />
              </Field>
              <Field data-invalid={Boolean(errors.validFrom) || undefined}>
                <FieldLabel htmlFor={fromId}>Gyldig fra</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={fromId}
                    type="datetime-local"
                    {...register("validFrom")}
                    aria-invalid={Boolean(errors.validFrom)}
                  />
                </InputGroup>
                <FieldError
                  className="text-[var(--color-bg-danger)]"
                  errors={errors.validFrom ? [errors.validFrom] : undefined}
                />
              </Field>
              <Field data-invalid={Boolean(errors.validTo) || undefined}>
                <FieldLabel htmlFor={toId}>Gyldig til</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={toId}
                    type="datetime-local"
                    {...register("validTo")}
                    aria-invalid={Boolean(errors.validTo)}
                  />
                </InputGroup>
                <FieldError
                  className="text-[var(--color-bg-danger)]"
                  errors={errors.validTo ? [errors.validTo] : undefined}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="surface" onClick={clearBounds}>
                  Ingen begrensning
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <Button type="submit" size="lg" disabled={save.isPending}>
                  Lagre
                </Button>
                <DialogClose asChild>
                  <Button variant="surface" size="lg">
                    Avbryt
                  </Button>
                </DialogClose>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RotatePinButton({
  id,
  name,
  onRotated,
}: {
  id: string
  name: string
  onRotated: (result: { pin?: string; token?: string }) => void
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const rotate = useMutation({
    mutationFn: () => patchPrinter(id, { rotatePin: true }),
    onMutate: () => {
      setConfirmOpen(false)
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) =>
        current?.map((item) => (item.id === id ? result.printer : item)),
      )
      onRotated({ pin: result.pin, token: result.token })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: printersQueryKey })
    },
  })

  return (
    <>
      <Button
        type="button"
        variant="surface"
        className="justify-start bg-black/20"
        disabled={rotate.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <RefreshCw className="size-5" aria-hidden />
        Rotér PIN
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Rotere PIN?</DialogTitle>
          <DialogDescription>
            Den gamle PIN-en for {name} slutter å virke. Innloggings-QR er uendret. Del den nye
            PIN-en.
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
              Rotér PIN
            </Button>
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RotateQrButton({
  id,
  name,
  onRotated,
}: {
  id: string
  name: string
  onRotated: (result: { pin?: string; token?: string }) => void
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const rotate = useMutation({
    mutationFn: () => patchPrinter(id, { rotateToken: true }),
    onMutate: () => {
      setConfirmOpen(false)
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) =>
        current?.map((item) => (item.id === id ? result.printer : item)),
      )
      onRotated({ pin: result.pin, token: result.token })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: printersQueryKey })
    },
  })

  return (
    <>
      <Button
        type="button"
        variant="surface"
        className="justify-start bg-black/20"
        disabled={rotate.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <RefreshCw className="size-5" aria-hidden />
        Ny innloggings-QR
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Ny innloggings-QR?</DialogTitle>
          <DialogDescription>
            Den gamle innloggingslenken for {name} slutter å virke. Skriv ut og lim ny QR under
            printeren. PIN er uendret.
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
              Ny QR
            </Button>
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DeactivatePrinterButton({
  id,
  name,
  banned,
}: {
  id: string
  name: string
  banned: boolean
}) {
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: (nextBanned: boolean) => patchPrinter(id, { banned: nextBanned }),
    onMutate: async (nextBanned) => {
      await queryClient.cancelQueries({ queryKey: printersQueryKey })
      const previous = queryClient.getQueryData<Printer[]>(printersQueryKey)
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) =>
        current?.map((item) => (item.id === id ? { ...item, banned: nextBanned } : item)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(printersQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: printersQueryKey })
    },
  })

  if (banned) {
    return (
      <Button
        type="button"
        size="lg"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(false)}
      >
        Aktiver
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="justify-start text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(true)}
    >
      Deaktiver {name}
    </Button>
  )
}

export function PrinterInventory({
  origin,
  printers: serverPrinters,
}: {
  origin: string
  printers: Printer[]
}) {
  const queryClient = useQueryClient()
  const [cacheReady, setCacheReady] = useState(false)
  const [secretsById, setSecretsById] = useState<Record<string, { pin?: string; token?: string }>>(
    {},
  )

  useLayoutEffect(() => {
    queryClient.setQueryData(printersQueryKey, serverPrinters)
    setCacheReady(true)
  }, [queryClient, serverPrinters])

  const { data } = useQuery({
    queryKey: printersQueryKey,
    queryFn: fetchPrinters,
    staleTime: 30_000,
  })

  const printers = cacheReady ? (data ?? serverPrinters) : serverPrinters

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-4xl">Printere</h1>
          <p className="mt-2 max-w-xl text-base opacity-70">
            Oppsett-QR synlig på printeren. Innloggings-QR under.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/printers/ny">Ny printer</Link>
        </Button>
      </header>

      {printers.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
          <div className="w-full max-w-xs">
            <StickerIllustration />
          </div>
          <h2 className="text-2xl">Ingen printere</h2>
          <p className="max-w-sm text-base opacity-70">
            Legg inn en printer, skriv ut klistremerkene og del PIN-en.
          </p>
          <Button asChild>
            <Link href="/admin/printers/ny">Ny printer</Link>
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {printers.map((printer) => {
            const status = statusLabel(printer)
            const secrets = secretsById[printer.id]
            const addressLabel = printer.connectType === "WiFi" ? "IP" : "MAC"

            return (
              <li
                key={printer.id}
                className="flex flex-col gap-4 rounded-2xl bg-[var(--color-bg-surface)] p-4"
              >
                <div className="flex gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl">{printer.name}</h2>
                      <span
                        className={
                          status.tone === "ok"
                            ? "rounded-lg bg-[color-mix(in_srgb,var(--color-fg-brand)_22%,transparent)] px-2 py-0.5 text-sm"
                            : status.tone === "warn"
                              ? "rounded-lg bg-white/10 px-2 py-0.5 text-sm opacity-80"
                              : "rounded-lg bg-[color-mix(in_srgb,var(--color-bg-danger)_22%,transparent)] px-2 py-0.5 text-sm"
                        }
                      >
                        {status.label}
                      </span>
                    </div>
                    <PrinterModelMeta modelId={printer.model} className="opacity-80" />
                    <p className="font-mono text-sm break-all opacity-60">
                      {addressLabel} {printer.address}
                      {printer.serial ? ` · SN ${printer.serial}` : ""}
                    </p>
                    <p className="text-sm opacity-60">
                      {formatValidity(printer.validFrom, printer.validTo)}
                    </p>
                  </div>
                  <PrinterModelThumb modelId={printer.model} size="md" className="self-start" />
                </div>

                <PrinterCardActions
                  printer={printer}
                  origin={origin}
                  secrets={secrets}
                  onSecrets={(result) =>
                    setSecretsById((current) => ({
                      ...current,
                      [printer.id]: {
                        pin: result.pin ?? current[printer.id]?.pin,
                        token: result.token ?? current[printer.id]?.token,
                      },
                    }))
                  }
                />
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
