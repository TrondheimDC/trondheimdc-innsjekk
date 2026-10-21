"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { osloOffset } from "@/lib/dashboard-data"
import {
  type Bucket,
  formatClock,
  type Interval,
  numberFormat,
  percentFormat,
} from "@/lib/dashboard-stats"
import { cn } from "@/lib/utils"

const MINUTE = 60_000
const HEIGHT = 240
const PAD = { top: 20, right: 16, bottom: 28, left: 40 }

const brand = "var(--color-fg-brand)"
const surface = "var(--color-bg-surface)"
const grid = "rgb(255 255 255 / 10%)"
const axisText = "rgb(254 254 254 / 55%)"

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

/** 0 / 5 / 10 …: about four clean steps up to at least `max`. */
function niceTicks(max: number): number[] {
  const raw = Math.max(1, max) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!
  const top = Math.max(step, Math.ceil(max / step) * step)
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step))
}

const TICK_STEPS = [1, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440]

/** Round Oslo clock times along the axis, at least 64 px apart. */
function timeTicks(start: number, end: number, plotWidth: number): number[] {
  const minutes = Math.max(1, (end - start) / MINUTE)
  const step = (TICK_STEPS.find((s) => (s / minutes) * plotWidth >= 64) ?? 1440) * MINUTE
  const offset = osloOffset(start)
  const ticks: number[] = []
  for (let wall = Math.ceil((start + offset) / step) * step; wall - offset <= end; wall += step) {
    ticks.push(wall - offset)
  }
  return ticks
}

/** A column with a 4 px rounded cap and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function Tooltip({
  x,
  value,
  label,
  width,
}: {
  x: number
  value: string
  label: string
  width: number
}) {
  // Flip to the left of the pointer near the right edge.
  const left = x > width - 160
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-lg border border-white/15 bg-[var(--color-bg-base)] px-3 py-2 shadow-lg"
      style={left ? { right: width - x + 12 } : { left: x + 12 }}
    >
      <p className="text-base font-semibold whitespace-nowrap tabular-nums">{value}</p>
      <p className="text-sm whitespace-nowrap opacity-70">{label}</p>
    </div>
  )
}

function Axes({
  width,
  start,
  end,
  yTicks,
  x,
  y,
  withDay,
}: {
  width: number
  start: number
  end: number
  yTicks: number[]
  x: (ms: number) => number
  y: (value: number) => number
  withDay: boolean
}) {
  const ticks = timeTicks(start, end, width - PAD.left - PAD.right)
  return (
    <g fontSize="12" fill={axisText} className="tabular-nums">
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={grid} />
          <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
            {numberFormat.format(tick)}
          </text>
        </g>
      ))}
      {ticks.map((tick) => (
        <text key={tick} x={x(tick)} y={HEIGHT - 8} textAnchor="middle">
          {formatClock(tick, withDay && (tick + osloOffset(tick)) % (1440 * MINUTE) === 0)}
        </text>
      ))}
    </g>
  )
}

/** Check-ins per interval: one column per minute / 5 / 15 / 60 minutes. */
export function CheckInBars({
  rows,
  interval,
  withDay,
}: {
  rows: Bucket[]
  interval: Interval
  withDay: boolean
}) {
  const { ref, width } = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const size = interval * MINUTE

  return (
    <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
      {width && rows.length > 0
        ? (() => {
            const start = rows[0]!.start
            const end = rows.at(-1)!.start + size
            const plotWidth = width - PAD.left - PAD.right
            const x = (ms: number) => PAD.left + ((ms - start) / (end - start)) * plotWidth
            const peak = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]!)
            const yTicks = niceTicks(peak.count)
            const top = yTicks.at(-1)!
            const y = (value: number) =>
              PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom)
            const slot = plotWidth / rows.length
            const gap = slot >= 6 ? 2 : slot >= 3 ? 1 : 0
            const barWidth = Math.max(1, Math.min(24, slot - gap))
            const hovered = hover == null ? null : rows[hover]
            return (
              <>
                <svg
                  width={width}
                  height={HEIGHT}
                  role="img"
                  aria-label={`Innsjekk per ${interval === 60 ? "time" : `${interval} min`}, flest ${peak.count}`}
                  onPointerLeave={() => setHover(null)}
                >
                  <Axes
                    width={width}
                    start={start}
                    end={end}
                    yTicks={yTicks}
                    x={x}
                    y={y}
                    withDay={withDay}
                  />
                  {rows.map((row, i) => {
                    const left = x(row.start) + (slot - barWidth) / 2
                    return (
                      <g key={row.start} onPointerEnter={() => setHover(i)}>
                        {/* Hit target: the whole slot, not just the painted column. */}
                        <rect
                          x={x(row.start)}
                          y={PAD.top}
                          width={slot}
                          height={HEIGHT - PAD.top - PAD.bottom}
                          fill="transparent"
                        />
                        {row.count > 0 ? (
                          <path
                            d={columnPath(left, y(row.count), barWidth, y(0) - y(row.count))}
                            fill={brand}
                            opacity={hover == null || hover === i ? 1 : 0.55}
                          />
                        ) : null}
                      </g>
                    )
                  })}
                  {/* The one value worth labeling: the busiest interval. */}
                  <text
                    x={x(peak.start) + slot / 2}
                    y={y(peak.count) - 6}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--color-fg-base)"
                    className="tabular-nums"
                  >
                    {numberFormat.format(peak.count)}
                  </text>
                </svg>
                {hovered && hover != null ? (
                  <Tooltip
                    x={x(hovered.start) + slot / 2}
                    width={width}
                    value={`${numberFormat.format(hovered.count)} innsjekket`}
                    label={
                      interval === 1
                        ? formatClock(hovered.start, withDay)
                        : `${formatClock(hovered.start, withDay)}–${formatClock(hovered.start + size)}`
                    }
                  />
                ) : null}
              </>
            )
          })()
        : null}
    </div>
  )
}

/** How many are in at each moment, with where half and 90 % were reached. */
export function CumulativeLine({
  times,
  start,
  end,
  totalAttendees,
  withDay,
}: {
  times: number[]
  start: number
  end: number
  totalAttendees: number
  withDay: boolean
}) {
  const { ref, width } = useWidth()
  const [pointer, setPointer] = useState<number | null>(null)
  const count = times.length

  return (
    <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
      {width && count > 0
        ? (() => {
            const plotWidth = width - PAD.left - PAD.right
            const x = (ms: number) => PAD.left + ((ms - start) / (end - start)) * plotWidth
            const yTicks = niceTicks(count)
            const top = yTicks.at(-1)!
            const y = (value: number) =>
              PAD.top + (1 - value / top) * (HEIGHT - PAD.top - PAD.bottom)

            let line = `M${x(start)},${y(0)}`
            times.forEach((time, i) => {
              line += `H${x(time)}V${y(i + 1)}`
            })
            line += `H${x(end)}`
            const area = `${line}V${y(0)}H${x(start)}Z`

            const marks = [0.5, 0.9].map((share) => {
              const index = Math.ceil(count * share) - 1
              return { share, at: times[index]!, value: index + 1 }
            })

            let readout: { at: number; value: number } | null = null
            if (pointer != null) {
              const at = start + ((pointer - PAD.left) / plotWidth) * (end - start)
              let lo = 0
              let hi = count
              while (lo < hi) {
                const mid = (lo + hi) >> 1
                if (times[mid]! <= at) lo = mid + 1
                else hi = mid
              }
              readout = { at, value: lo }
            }

            return (
              <>
                <svg
                  width={width}
                  height={HEIGHT}
                  role="img"
                  aria-label={`Innsjekket totalt over tid, ${count} til slutt`}
                  onPointerMove={(event) => {
                    const box = event.currentTarget.getBoundingClientRect()
                    const px = event.clientX - box.left
                    setPointer(Math.min(width - PAD.right, Math.max(PAD.left, px)))
                  }}
                  onPointerLeave={() => setPointer(null)}
                >
                  <Axes
                    width={width}
                    start={start}
                    end={end}
                    yTicks={yTicks}
                    x={x}
                    y={y}
                    withDay={withDay}
                  />
                  <path d={area} fill={brand} opacity={0.1} />
                  <path
                    d={line}
                    fill="none"
                    stroke={brand}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {marks.map((mark) => (
                    <g key={mark.share}>
                      <circle
                        cx={x(mark.at)}
                        cy={y(mark.value)}
                        r={5}
                        fill={brand}
                        stroke={surface}
                        strokeWidth={2}
                      />
                      <text
                        x={x(mark.at) - 8}
                        y={y(mark.value) - 8}
                        textAnchor="end"
                        fontSize="12"
                        fill="var(--color-fg-base)"
                      >
                        {percentFormat.format(mark.share)} · {formatClock(mark.at, withDay)}
                      </text>
                    </g>
                  ))}
                  <text
                    x={width - PAD.right}
                    y={y(count) - 8}
                    textAnchor="end"
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--color-fg-base)"
                    className="tabular-nums"
                  >
                    {numberFormat.format(count)}
                  </text>
                  {readout && pointer != null ? (
                    <g pointerEvents="none">
                      <line
                        x1={pointer}
                        x2={pointer}
                        y1={PAD.top}
                        y2={HEIGHT - PAD.bottom}
                        stroke="rgb(255 255 255 / 35%)"
                      />
                      <circle
                        cx={pointer}
                        cy={y(readout.value)}
                        r={5}
                        fill={brand}
                        stroke={surface}
                        strokeWidth={2}
                      />
                    </g>
                  ) : null}
                </svg>
                {readout && pointer != null ? (
                  <Tooltip
                    x={pointer}
                    width={width}
                    value={`${numberFormat.format(readout.value)} innsjekket`}
                    label={`kl. ${formatClock(readout.at, withDay)}${
                      totalAttendees > 0
                        ? ` · ${percentFormat.format(readout.value / totalAttendees)} av påmeldte`
                        : ""
                    }`}
                  />
                ) : null}
              </>
            )
          })()
        : null}
    </div>
  )
}

/** The same numbers as the charts, for reading without hovering. */
export function BucketTable({
  rows,
  interval,
  withDay,
  className,
}: {
  rows: Bucket[]
  interval: Interval
  withDay: boolean
  className?: string
}) {
  const size = interval * MINUTE
  const filled = rows.filter((row) => row.count > 0)
  return (
    <details className={cn("group", className)}>
      <summary className="cursor-pointer text-sm opacity-70 hover:opacity-100">
        Vis som tabell
      </summary>
      <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-white/10">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 bg-[var(--color-bg-surface)] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Tid</th>
              <th className="px-3 py-2 text-right font-medium">Innsjekk</th>
              <th className="px-3 py-2 text-right font-medium">Totalt</th>
            </tr>
          </thead>
          <tbody>
            {filled.map((row) => (
              <tr key={row.start} className="border-t border-white/10">
                <td className="px-3 py-1.5">
                  {interval === 1
                    ? formatClock(row.start, withDay)
                    : `${formatClock(row.start, withDay)}–${formatClock(row.start + size)}`}
                </td>
                <td className="px-3 py-1.5 text-right">{numberFormat.format(row.count)}</td>
                <td className="px-3 py-1.5 text-right">{numberFormat.format(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
