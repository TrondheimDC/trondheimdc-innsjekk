"use client"

import { useEffect, useRef } from "react"
import { BADGE_DOTS, renderBadge } from "@/lib/badge-render"
import { cn } from "@/lib/utils"

/** DK-11208 is 38 × 90 mm (449 × 1063 dots at 300 dpi); the printer leaves the rest unprinted. */
const LABEL_DOTS = { across: 449, along: 1063 } as const
const MARGIN_DOTS = {
  across: (LABEL_DOTS.across - BADGE_DOTS.across) / 2,
  along: (LABEL_DOTS.along - BADGE_DOTS.along) / 2,
} as const

/** The exact dots a USB print sends, drawn the way the badge is read, inside the unprinted label margin. */
export function BadgePreview({
  name,
  line2,
  line3,
  qr,
  template,
  className,
}: {
  name: string | null | undefined
  line2: string
  /** With `qr`: the badge with a QR code (`badge-qr-layout`). */
  line3?: string
  qr?: string | null
  template?: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    void renderBadge({ name: name ?? null, line2, line3, qr, template }).then((rendered) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (cancelled || !canvas || !ctx) return
      ctx.drawImage(rendered, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [name, line2, line3, qr, template])

  return (
    <div
      className={cn("w-full rounded-lg bg-white", className)}
      style={{
        padding: `${(MARGIN_DOTS.across / LABEL_DOTS.along) * 100}% ${(MARGIN_DOTS.along / LABEL_DOTS.along) * 100}%`,
      }}
    >
      <canvas
        ref={canvasRef}
        width={BADGE_DOTS.along}
        height={BADGE_DOTS.across}
        aria-label={`Forhåndsvisning: ${name}`}
        className="block aspect-[991/413] w-full"
      />
    </div>
  )
}
