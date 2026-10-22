"use client"

import { useId, useLayoutEffect, useRef, useState } from "react"
import { osloOffset } from "@/lib/dashboard-data"
import {
  type Bucket,
  formatClock,
  type Interval,
  numberFormat,
  type Span,
} from "@/lib/dashboard-stats"

const MINUTE = 60_000
const HEIGHT = 220
const PAD = { top: 16, right: 12, bottom: 24, left: 36 }

const brand = "var(--color-fg-brand)"
const base = "var(--color-bg-base)"
const grid = "rgb(255 255 255 / 8%)"
const axisText = "rgb(254 254 254 / 45%)"

/** Width of the chart box; the height is fixed so nothing below moves when it draws. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** 0 / 5 / 10 …: about four clean steps up to at least `max`. Counts are whole, so steps are too. */
function niceTicks(max: number): number[] {
  const raw = Math.max(1, max) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!)
  const top = Math.max(step, Math.ceil(max / step) * step)
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

const TICK_STEPS = [1, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440]

/** Round Oslo clock times along the axis, at least 72 px apart. */
function timeTicks(start: number, end: number, plotWidth: number): number[] {
  const minutes = Math.max(1, (end - start) / MINUTE)
  const step = (TICK_STEPS.find((s) => (s / minutes) * plotWidth >= 72) ?? 1440) * MINUTE
  const offset = osloOffset(start)
  const ticks: number[] = []
  for (let wall = Math.ceil((start + offset) / step) * step; wall - offset <= end; wall += step) {
    ticks.push(wall - offset)
  }
  return ticks
}

/**
 * A smooth line through the points that never overshoots them (monotone cubic,
 * Fritsch–Carlson), so a quiet minute never dips below zero.
 */
function smoothPath(points: [number, number][]): string {
  const n = points.length
  if (n === 0) return ""
  if (n === 1) return `M${points[0]![0]},${points[0]![1]}`
  const dx = points.slice(1).map(([x], i) => x - points[i]![0])
  const slope = points.slice(1).map(([, y], i) => (y - points[i]![1]) / dx[i]!)
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!
    if (i === n - 1) return slope[n - 2]!
    const a = slope[i - 1]!
    const b = slope[i]!
    return a * b <= 0
      ? 0
      : (3 * (dx[i - 1]! + dx[i]!)) /
          ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b)
  })
  let path = `M${points[0]![0]},${points[0]![1]}`
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!
    const [x1, y1] = points[i + 1]!
    const h = dx[i]! / 3
    path += `C${x0 + h},${y0 + h * tangent[i]!} ${x1 - h},${y1 - h * tangent[i + 1]!} ${x1},${y1}`
  }
  return path
}

export type ChartMode = "interval" | "total"

export interface TooltipRow {
  name: string
  count: number
}

/**
 * Check-ins over the day as one area: per interval, or the running total.
 * The crosshair snaps to an interval and splits it by printer. With a mouse, drag across
 * the chart to zoom in on that stretch.
 */
export function CheckInChart({
  rows,
  span,
  interval,
  mode,
  withDay,
  marks,
  breakdown,
  onZoom,
}: {
  rows: Bucket[]
  /** The time axis; `rows` may stop short of its end (now, while the door is still open). */
  span: Span
  interval: Interval
  mode: ChartMode
  withDay: boolean
  /** Labeled dots on the running total (50 % / 90 %). */
  marks: { label: string; at: number; value: number }[]
  breakdown: (bucket: Bucket) => TooltipRow[]
  onZoom: (span: Span) => void
}) {
  const { ref, width } = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const gradientId = useId()
  const size = interval * MINUTE

  if (rows.length === 0) return <div ref={ref} style={{ height: HEIGHT }} />

  // Per interval: a point mid-bucket. Total: the count at the end of each bucket.
  const { start, end } = span
  const rowsEnd = rows.at(-1)!.start + size
  const values = rows.map((row) => (mode === "interval" ? row.count : row.total))
  const at = (i: number) =>
    mode === "interval" ? rows[i]!.start + size / 2 : rows[i]!.start + size
  const max = Math.max(...values)
  const yTicks = niceTicks(max)
  const top = yTicks.at(-1)!

  return (
    <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
      {width
        ? (() => {
            const plotWidth = width - PAD.left - PAD.right
            const x = (ms: number) => PAD.left + ((ms - start) / (end - start)) * plotWidth
            const y = (value: number) =>
              PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom)
            const points: [number, number][] = values.map((value, i) => [x(at(i)), y(value)])
            const rowsStart = rows[0]!.start
            if (mode === "total") {
              points.unshift([x(rowsStart), y(rows[0]!.total - rows[0]!.count)])
            }
            // One interval alone is a point, not a line: rise from and fall back to the baseline.
            else if (points.length === 1) points.splice(0, 0, [x(rowsStart), y(0)])
            if (mode === "interval" && rows.length === 1) points.push([x(rowsEnd), y(0)])
            const line = smoothPath(points)
            const area = `${line}L${points.at(-1)![0]},${y(0)}L${points[0]![0]},${y(0)}Z`
            const peakIndex = values.indexOf(max)
            const hovered = hover == null ? null : rows[hover]!
            const hoverX = hover == null ? 0 : x(at(hover))
            const timeAt = (event: React.PointerEvent<SVGSVGElement>) => {
              const px = event.clientX - event.currentTarget.getBoundingClientRect().left
              const ms = start + ((px - PAD.left) / plotWidth) * (end - start)
              return Math.min(end, Math.max(start, ms))
            }

            return (
              <>
                <svg
                  width={width}
                  height={HEIGHT}
                  role="img"
                  aria-label={
                    mode === "interval"
                      ? `Innsjekk per ${interval === 60 ? "time" : `${interval} min`}, flest ${max}`
                      : `Innsjekket totalt, ${max} til slutt`
                  }
                  className="cursor-crosshair select-none"
                  // Mouse only: a finger dragging sideways should still scroll the page.
                  onPointerDown={(event) => {
                    if (event.pointerType !== "mouse" || event.button !== 0) return
                    event.currentTarget.setPointerCapture(event.pointerId)
                    const ms = timeAt(event)
                    setDrag({ from: ms, to: ms })
                  }}
                  onPointerMove={(event) => {
                    const ms = timeAt(event)
                    if (drag) {
                      setDrag({ ...drag, to: ms })
                      return
                    }
                    const i = Math.floor((ms - rowsStart) / size)
                    setHover(Math.min(rows.length - 1, Math.max(0, i)))
                  }}
                  onPointerUp={() => {
                    if (!drag) return
                    setDrag(null)
                    const from = Math.floor(Math.min(drag.from, drag.to) / MINUTE) * MINUTE
                    const to = Math.ceil(Math.max(drag.from, drag.to) / MINUTE) * MINUTE
                    // A click, not a drag: keep the crosshair.
                    if (to - from >= 2 * MINUTE) onZoom({ start: from, end: to })
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onPointerLeave={() => setHover(null)}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={brand} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={brand} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <g fontSize="11" fill={axisText} className="tabular-nums">
                    {yTicks.map((tick) => (
                      <g key={tick}>
                        <line
                          x1={PAD.left}
                          x2={width - PAD.right}
                          y1={y(tick)}
                          y2={y(tick)}
                          stroke={grid}
                        />
                        <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                          {numberFormat.format(tick)}
                        </text>
                      </g>
                    ))}
                    {timeTicks(start, end, plotWidth).map((tick) => (
                      <text
                        key={tick}
                        x={x(tick)}
                        y={HEIGHT - 6}
                        // Near the right edge, end on the tick so the label is not cut off.
                        textAnchor={x(tick) > width - PAD.right - 20 ? "end" : "middle"}
                      >
                        {formatClock(
                          tick,
                          withDay && (tick + osloOffset(tick)) % (1440 * MINUTE) === 0,
                        )}
                      </text>
                    ))}
                  </g>
                  <path d={area} fill={`url(#${gradientId})`} />
                  <path
                    d={line}
                    fill="none"
                    stroke={brand}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {mode === "interval" ? (
                    // The one value worth labeling: the busiest interval.
                    <text
                      x={x(at(peakIndex))}
                      y={y(max) - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--color-fg-base)"
                      className="tabular-nums"
                    >
                      {numberFormat.format(max)}
                    </text>
                  ) : (
                    marks.map((mark) => (
                      <g key={mark.label}>
                        <circle
                          cx={x(mark.at)}
                          cy={y(mark.value)}
                          r={4}
                          fill={brand}
                          stroke={base}
                          strokeWidth={2}
                        />
                        <text
                          // Near the left edge (zoomed in), label to the right of the dot.
                          x={x(mark.at) < PAD.left + 100 ? x(mark.at) + 8 : x(mark.at) - 8}
                          y={y(mark.value) - 8}
                          textAnchor={x(mark.at) < PAD.left + 100 ? "start" : "end"}
                          fontSize="11"
                          fill="var(--color-fg-base)"
                        >
                          {mark.label}
                        </text>
                      </g>
                    ))
                  )}
                  {drag ? (
                    <rect
                      x={x(Math.min(drag.from, drag.to))}
                      y={PAD.top}
                      width={Math.abs(x(drag.to) - x(drag.from))}
                      height={HEIGHT - PAD.top - PAD.bottom}
                      fill="rgb(255 255 255 / 8%)"
                      stroke="rgb(255 255 255 / 25%)"
                      pointerEvents="none"
                    />
                  ) : null}
                  {hovered && !drag ? (
                    <g pointerEvents="none">
                      <line
                        x1={hoverX}
                        x2={hoverX}
                        y1={PAD.top}
                        y2={HEIGHT - PAD.bottom}
                        stroke="rgb(255 255 255 / 30%)"
                      />
                      <circle
                        cx={hoverX}
                        cy={y(values[hover!]!)}
                        r={4}
                        fill={brand}
                        stroke={base}
                        strokeWidth={2}
                      />
                    </g>
                  ) : null}
                </svg>
                {hovered && !drag ? (
                  <ChartTooltip
                    x={hoverX}
                    width={width}
                    title={
                      interval === 1
                        ? formatClock(hovered.start, withDay)
                        : `${formatClock(hovered.start, withDay)}–${formatClock(hovered.start + size)}`
                    }
                    rows={breakdown(hovered)}
                    total={hovered.count}
                    runningTotal={mode === "total" ? hovered.total : null}
                  />
                ) : null}
              </>
            )
          })()
        : null}
    </div>
  )
}

function ChartTooltip({
  x,
  width,
  title,
  rows,
  total,
  runningTotal,
}: {
  x: number
  width: number
  title: string
  rows: TooltipRow[]
  total: number
  runningTotal: number | null
}) {
  // Flip to the left of the crosshair near the right edge.
  const left = x > width - 200
  return (
    <div
      className="pointer-events-none absolute top-6 z-10 min-w-44 rounded-lg border border-white/10 bg-[var(--color-bg-base)]/95 px-3 py-2 text-xs shadow-lg"
      style={left ? { right: width - x + 12 } : { left: x + 12 }}
    >
      <p className="mb-1.5 opacity-60">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex justify-between gap-6">
          <span className="truncate opacity-80">{row.name}</span>
          <span className="font-semibold tabular-nums">{numberFormat.format(row.count)}</span>
        </p>
      ))}
      <p className="mt-1.5 flex justify-between gap-6 border-t border-white/10 pt-1.5">
        <span className="opacity-80">I intervallet</span>
        <span className="font-semibold tabular-nums">{numberFormat.format(total)}</span>
      </p>
      {runningTotal != null ? (
        <p className="flex justify-between gap-6">
          <span className="opacity-80">Totalt</span>
          <span className="font-semibold tabular-nums">{numberFormat.format(runningTotal)}</span>
        </p>
      ) : null}
    </div>
  )
}
