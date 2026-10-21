import type { ReactNode } from "react"
import { loginStickerText, setupStickerText } from "@/lib/public-app-url"
import { cn } from "@/lib/utils"
import {
  AppWindow,
  BluetoothGlyph,
  brand,
  danger,
  ink,
  Laptop,
  lcdText,
  Phone,
  paper,
  QlPrinter,
  Sticker,
  Toggle,
  UsbGlyph,
} from "./parts"

type ArtProps = { className?: string }

/** Placeholder text on drawn stickers. */
const printerName = "Printernavn"

/** Setup sticker on the front of a printer that is already set up (`QlPrinter` units). */
function FrontSticker() {
  return <Sticker x={42} y={141} w={86} name={setupStickerText(printerName)} seed={3} />
}

function Scene({ label, className, children }: ArtProps & { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full font-sans", className)}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  )
}

/** Idle printer screen: a few status bars and the Bluetooth icon top right. */
function LcdIdle({ bluetooth = lcdText }: { bluetooth?: string }) {
  return (
    <>
      <rect x="6" y="6" width="26" height="3" rx="1.5" fill={lcdText} opacity="0.5" />
      <rect x="6" y="16" width="56" height="5" rx="2" fill={lcdText} opacity="0.85" />
      <rect x="6" y="25" width="36" height="4" rx="2" fill={lcdText} opacity="0.5" />
      <BluetoothGlyph x={81} y={3} size={11} color={bluetooth} />
    </>
  )
}

function DottedArrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const dots = []
  for (let x = x1; x < x2 - 10; x += 9) dots.push(x)
  return (
    <g fill={brand}>
      {dots.map((x) => (
        <circle key={x} cx={x} cy={y} r="2.4" />
      ))}
      <path
        d={`M${x2 - 8} ${y - 6}l7 6-7 6`}
        fill="none"
        stroke={brand}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/** `/oppsett` Bluetooth-on: the icon sits top right on the printer screen. */
export function PrinterBluetoothIllustration({ className }: ArtProps) {
  // LCD icon centre in scene units: printer at (40, 30) × 1.02, icon at local (123.5, 54.5).
  const ix = 40 + 123.5 * 1.02
  const iy = 30 + 54.5 * 1.02
  return (
    <Scene label="Bluetooth-ikonet øverst til høyre på printerskjermen" className={className}>
      <QlPrinter x={40} y={30} scale={1.02} lcd={<LcdIdle bluetooth={brand} />}>
        <FrontSticker />
      </QlPrinter>
      <circle cx={ix} cy={iy} r="9" fill="none" stroke={brand} strokeWidth="2" />
      <path
        d={`M${ix + 7} ${iy - 7}L256 58`}
        stroke={brand}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="276" cy="44" r="28" fill="#1d1d1d" stroke={brand} strokeWidth="2.5" />
      <BluetoothGlyph x={258} y={26} size={36} color={brand} />
    </Scene>
  )
}

/** `/oppsett` pair: pick the printer under Bluetooth in phone settings. */
export function PhonePairIllustration({ className }: ArtProps) {
  return (
    <Scene label="Telefonens Bluetooth-liste med QL-820NWB valgt" className={className}>
      <Phone x={12} y={12} w={124} h={216}>
        <BluetoothGlyph x={14} y={36} size={13} color="#8a8a8a" />
        <text x="32" y="47" fill={paper} fontSize="11" fontWeight="600">
          Bluetooth
        </text>
        <Toggle x={88} y={37} />

        <rect x="12" y="62" width="100" height="28" rx="7" fill={brand} />
        <text x="20" y="80" fill={ink} fontSize="9" fontWeight="700">
          QL-820NWB(XXXX)
        </text>
        {[98, 128].map((y) => (
          <g key={y}>
            <rect x="20" y={y + 10} width="54" height="6" rx="3" fill="#3a3a3a" />
            <circle cx="102" cy={y + 13} r="5" fill="none" stroke="#4a4a4a" strokeWidth="1.5" />
            <rect x="12" y={y + 26} width="100" height="1" fill="#2a2a2a" />
          </g>
        ))}
      </Phone>
      <DottedArrow x1={150} x2={198} y={120} />
      <QlPrinter x={204} y={62} scale={0.62} lcd={<LcdIdle bluetooth={brand} />}>
        <FrontSticker />
      </QlPrinter>
    </Scene>
  )
}

/** `/oppsett` scan: the setup sticker sits on the front of the printer. */
export function ScanStickerIllustration({ className }: ArtProps) {
  const corner = (x: number, y: number, dx: number, dy: number) => (
    <path
      d={`M${x} ${y + dy * 12}V${y}H${x + dx * 12}`}
      fill="none"
      stroke={brand}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
  return (
    <Scene label="Skann QR-klistremerket foran på printeren" className={className}>
      <QlPrinter x={14} y={26} scale={1} lcd={<LcdIdle />}>
        <FrontSticker />
        <rect
          x="38"
          y="137"
          width="94"
          height="44.4"
          rx="7"
          fill="none"
          stroke={brand}
          strokeWidth="2.5"
        />
      </QlPrinter>

      <Phone x={206} y={24} w={102} h={192} screen="#1d1d1d">
        <Sticker x={12} y={80} w={78} name={setupStickerText(printerName)} seed={3} />
        {corner(8, 72, 1, 1)}
        {corner(94, 72, -1, 1)}
        {corner(8, 121, 1, -1)}
        {corner(94, 121, -1, -1)}
      </Phone>
    </Scene>
  )
}

/** Door login: the login sticker is on the underside of the printer. */
export function LoginQrUnderPrinterIllustration({ className }: ArtProps) {
  return (
    <Scene label="Innloggings-QR limt under printeren" className={className}>
      <QlPrinter x={20} y={40} scale={0.7} lcd={<LcdIdle />}>
        <FrontSticker />
      </QlPrinter>

      <path
        d="M96 204C116 236 166 236 186 198"
        fill="none"
        stroke={brand}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M176.2 203L186 198l1.4 10.9"
        fill="none"
        stroke={brand}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Underside: the printer's base, feet in the corners */}
      <rect x="196" y="30" width="108" height="172" rx="24" fill="#e4e4e4" />
      <rect
        x="206"
        y="40"
        width="88"
        height="152"
        rx="16"
        fill="none"
        stroke="#cfcfcf"
        strokeWidth="1.5"
      />
      {[
        [216, 50],
        [284, 50],
        [216, 182],
        [284, 182],
      ].map(([cx, cy]) => (
        <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="8" ry="5" fill="#3a3a3a" />
      ))}
      <Sticker x={208} y={97} w={84} name={loginStickerText(printerName)} seed={7} login />
    </Scene>
  )
}

/** Enroll: read the Bluetooth address from the printer menu. */
export function MacMenuIllustration({ className }: ArtProps) {
  return (
    <Scene label="Printermeny som viser Bluetooth-adresse" className={className}>
      <QlPrinter x={16} y={66} scale={0.62} lcd={<LcdIdle />} />
      <path
        d="M98.5 94.5L154 52M98.5 115.6L154 164"
        stroke={paper}
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <rect x="148" y="46" width="164" height="124" rx="10" fill="#0b0b0b" />
      <rect x="154" y="52" width="152" height="112" rx="6" fill="#56605a" />
      <g className="font-mono">
        <text x="164" y="76" fill={lcdText} fontSize="12" fontWeight="700">
          Bluetooth Status
        </text>
        <text x="164" y="100" fill={lcdText} fontSize="11">
          Device: QL-820NWB
        </text>
        <rect x="158" y="114" width="144" height="26" rx="4" fill={brand} />
        <text x="164" y="131" fill={ink} fontSize="11" fontWeight="700">
          Address: 00:1B:A9:…
        </text>
      </g>
    </Scene>
  )
}

/** Enroll: the serial barcode label is inside the printer, below the DK roll. */
export function SerialIllustration({ className }: ArtProps) {
  // Serial label under the roll on the open printer: local (85, 61) at (16, 84) × 0.66.
  const sx = 16 + 85 * 0.66
  const sy = 84 + 61 * 0.66
  return (
    <Scene
      label="Strekkode med serienummer inne i printeren, under etikettrullen"
      className={className}
    >
      <QlPrinter x={16} y={84} scale={0.66} open />
      <circle cx={sx} cy={sy} r="13" fill="none" stroke={brand} strokeWidth="2" />
      <path
        d={`M${sx + 12} ${sy - 6}L168 76M${sx + 12} ${sy + 6}L168 150`}
        stroke={paper}
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <rect x="168" y="62" width="140" height="100" rx="8" fill={paper} />
      {Array.from({ length: 30 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
          key={i}
          x={182 + i * 3.8}
          y="78"
          width={i % 3 === 0 ? 2.4 : i % 2 === 0 ? 1.6 : 1}
          height="44"
          fill={ink}
        />
      ))}
      <text
        x="238"
        y="146"
        textAnchor="middle"
        fill={ink}
        fontSize="13"
        fontWeight="700"
        className="font-mono"
      >
        E00000…
      </text>
    </Scene>
  )
}

/** Enroll / inventory: the printer prints the setup sticker (QR beside the name). */
export function StickerIllustration({ className }: ArtProps) {
  return (
    <Scene label="Printeren skriver ut etikett med QR og navn" className={className}>
      <QlPrinter x={79} y={8} scale={0.95} lcd={<LcdIdle />}>
        <FrontSticker />
      </QlPrinter>
    </Scene>
  )
}

/** `/oppsett` USB: laptop and printer joined by the USB cable. */
export function UsbCableIllustration({ className }: ArtProps) {
  return (
    <Scene label="PC koblet til printeren med USB-kabel" className={className}>
      <Laptop x={20} y={62} w={146} h={96}>
        <UsbGlyph x={55} y={20} size={36} color={brand} />
        <rect x="28" y="64" width="90" height="16" rx="5" fill={brand} />
        <text x="73" y="75" textAnchor="middle" fill={ink} fontSize="8" fontWeight="700">
          Koble til printer
        </text>
      </Laptop>

      {/* Cable from the laptop's side into the printer */}
      <path
        d="M186 166C204 166 196 130 214 130"
        fill="none"
        stroke="#8a8a8a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="176" y="161" width="12" height="10" rx="2" fill="#cfcfcf" />
      <QlPrinter x={206} y={56} scale={0.62} lcd={<LcdIdle />}>
        <FrontSticker />
      </QlPrinter>
      <rect x="204" y="124" width="14" height="12" rx="2" fill={brand} />
    </Scene>
  )
}

/** `/oppsett` USB connect: Chrome's device picker with the printer selected. */
export function UsbPickerIllustration({ className }: ArtProps) {
  return (
    <Scene label="Nettleserens USB-liste med QL-820NWB valgt" className={className}>
      <Laptop x={36} y={18} w={248} h={172}>
        <rect x="6" y="6" width="236" height="14" rx="5" fill="#2a2a2a" />
        {[16, 26, 36].map((cx) => (
          <circle key={cx} cx={cx} cy="13" r="2.5" fill="#4a4a4a" />
        ))}
        <rect x="52" y="10" width="140" height="6" rx="3" fill="#3a3a3a" />

        <rect x="30" y="34" width="188" height="122" rx="10" fill="#262626" />
        <text x="44" y="54" fill={paper} fontSize="9" fontWeight="600">
          innsjekk.trondheimdc.no vil koble til
        </text>
        <rect x="40" y="66" width="168" height="26" rx="6" fill={brand} />
        <UsbGlyph x={48} y={72} size={14} color={ink} />
        <text x="68" y="83" fill={ink} fontSize="10" fontWeight="700">
          QL-820NWB
        </text>
        <rect x="40" y="98" width="168" height="1" fill="#3a3a3a" />
        <rect x="110" y="126" width="46" height="20" rx="10" fill="none" stroke="#5a5a5a" />
        <text x="133" y="139" textAnchor="middle" fill={paper} fontSize="8">
          Avbryt
        </text>
        <rect x="160" y="126" width="50" height="20" rx="10" fill={brand} />
        <text x="185" y="139" textAnchor="middle" fill={ink} fontSize="8" fontWeight="700">
          Koble til
        </text>
      </Laptop>
    </Scene>
  )
}

/** `/oppsett` USB driver step on Windows: Zadig with the printer picked, WinUSB as target, Replace Driver. */
export function ZadigIllustration({ className }: ArtProps) {
  const field = "#f7f7f7"
  const edge = "#b8b8b8"
  const box = (x: number, w: number, y: number, text: string, size = 7.5) => (
    <g key={`${x}-${text}`}>
      <rect x={x} y={y} width={w} height="15" rx="2" fill={field} stroke={edge} />
      <text x={x + 5} y={y + 10.5} fill={ink} fontSize={size}>
        {text}
      </text>
    </g>
  )
  return (
    <Scene label="Zadig med QL-820NWB valgt, WinUSB og Replace Driver" className={className}>
      <AppWindow x={20} y={54} w={280} h={132} title="Zadig" light>
        <g fill={ink} fontSize="8">
          <text x="10" y="13">
            Device
          </text>
          <text x="46" y="13">
            Options
          </text>
          <text x="86" y="13">
            Help
          </text>
        </g>

        <rect
          x="8"
          y="20"
          width="230"
          height="17"
          rx="2"
          fill="#fff"
          stroke={brand}
          strokeWidth="2.5"
        />
        <text x="14" y="32" fill={ink} fontSize="8.5" fontWeight="700">
          QL-820NWB (Interface 0)
        </text>
        <path d="M223 27l4 4 4-4" fill="none" stroke={ink} strokeWidth="1.3" />
        <rect x="244" y="24" width="8" height="8" fill="#fff" stroke={ink} />
        <text x="255" y="31.5" fill={ink} fontSize="7.5">
          Edit
        </text>

        <text x="10" y="58" fill={ink} fontSize="8">
          Driver
        </text>
        {box(42, 62, 47, "usbprint")}
        <path
          d="M108 54.5h14m-5-5 5 5-5 5"
          fill="none"
          stroke="#3aa655"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="130"
          y="47"
          width="98"
          height="15"
          rx="2"
          fill="#fff"
          stroke={brand}
          strokeWidth="2.5"
        />
        <text x="135" y="57.5" fill={ink} fontSize="6.8" fontWeight="700">
          WinUSB (v6.1.7600.16385)
        </text>

        <text x="10" y="80" fill={ink} fontSize="8">
          USB ID
        </text>
        {box(42, 24, 69, "04F9")}
        {box(70, 24, 69, "209D")}
        {box(98, 16, 69, "00")}

        <rect x="130" y="68" width="98" height="24" rx="4" fill={brand} />
        <text x="179" y="83" textAnchor="middle" fill={ink} fontSize="9" fontWeight="700">
          Replace Driver
        </text>
      </AppWindow>
    </Scene>
  )
}

/** `/oppsett` USB driver step on Linux: the udev rule and the reload in a terminal. */
export function LinuxUdevIllustration({ className }: ArtProps) {
  const lines: [string, string][] = [
    ["$", "echo '…TAG+=\"uaccess\"' | sudo tee /etc/udev/"],
    ["", "rules.d/60-brother-ql.rules"],
    ["$", "sudo udevadm control --reload"],
    ["$", "sudo modprobe -r usblp"],
  ]
  return (
    <Scene label="Terminal med udev-regel for printeren" className={className}>
      <AppWindow x={20} y={40} w={280} h={160} title="Terminal">
        <g className="font-mono" fontSize="8">
          {lines.map(([prompt, text], i) => (
            <text key={text} x="14" y={26 + i * 26} fill={paper}>
              {prompt ? <tspan fill={brand}>{prompt} </tspan> : null}
              {text}
            </text>
          ))}
        </g>
        <rect x="14" y={26 + 4 * 26 - 8} width="6" height="10" fill={brand} />
      </AppWindow>
    </Scene>
  )
}

/** Torn-off label: flat top, zigzag bottom, in local units. */
function tornLabel(w: number, h: number, tooth = 7) {
  let d = `M0 0H${w}V${h}`
  for (let x = w; x > 0; x -= tooth) {
    d += `L${x - tooth / 2} ${h - 4}L${Math.max(x - tooth, 0)} ${h}`
  }
  return `${d}Z`
}

/** 404: the printer feeds out a label that reads 404. */
export function LabelNotFoundIllustration({ className }: ArtProps) {
  return (
    <Scene label="Printeren skriver ut en etikett med 404" className={className}>
      <defs>
        <clipPath id="label-feed-clip">
          <rect x="0" y="127" width="170" height="130" />
        </clipPath>
      </defs>
      <QlPrinter x={75} y={4} scale={0.95} lcd={<LcdIdle />}>
        <g clipPath="url(#label-feed-clip)">
          <g className="error-label-feed">
            <g transform="translate(43 124)">
              <path d={tornLabel(84, 116)} fill={paper} />
              <text
                x="42"
                y="46"
                textAnchor="middle"
                fill={ink}
                fontSize="34"
                fontWeight="700"
                className="font-display"
              >
                404
              </text>
              <text
                x="42"
                y="62"
                textAnchor="middle"
                fill={ink}
                fontSize="7"
                fontWeight="700"
                letterSpacing="1.4"
                className="font-mono"
              >
                IKKE FUNNET
              </text>
              {Array.from({ length: 18 }, (_, i) => (
                <rect
                  // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
                  key={i}
                  x={12 + i * 3.4}
                  y="74"
                  width={i % 3 === 0 ? 2 : i % 2 === 0 ? 1.4 : 0.9}
                  height="22"
                  fill={ink}
                />
              ))}
            </g>
          </g>
        </g>
      </QlPrinter>
    </Scene>
  )
}

/** Error: the printer screen warns and the label jams in the exit. */
export function PrinterErrorIllustration({ className }: ArtProps) {
  // Accordion-folded label: left and right edges, one fold per segment.
  const left = [
    [48, 124],
    [58, 146],
    [42, 166],
    [56, 188],
  ]
  const right = [
    [122, 124],
    [130, 144],
    [116, 166],
    [128, 186],
  ]
  return (
    <Scene label="Printerskjermen viser feil og etiketten har satt seg fast" className={className}>
      <QlPrinter
        x={62}
        y={34}
        scale={0.95}
        lcd={
          <>
            <g className="error-lcd-blink">
              <path d="M7 27 16 8l9 19z" fill={danger} />
              <rect x="15" y="14" width="2" height="7" rx="1" fill={ink} />
              <circle cx="16" cy="24" r="1.2" fill={ink} />
            </g>
            <rect x="32" y="11" width="52" height="5" rx="2" fill={lcdText} opacity="0.85" />
            <rect x="32" y="20" width="34" height="4" rx="2" fill={lcdText} opacity="0.5" />
          </>
        }
      >
        {left.slice(0, -1).map(([lx, ly], i) => {
          const [nlx, nly] = left[i + 1]
          const [rx, ry] = right[i]
          const [nrx, nry] = right[i + 1]
          return (
            <path
              key={`${lx}-${ly}`}
              d={`M${lx} ${ly}L${rx} ${ry}L${nrx} ${nry}L${nlx} ${nly}Z`}
              fill={i % 2 === 0 ? paper : "#d6d6d6"}
              stroke="#bdbdbd"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          )
        })}
        {/* Half-printed lines, skewed with each fold */}
        <g fill={ink} opacity="0.7">
          <rect x="66" y="152" width="34" height="3.5" rx="1.5" transform="rotate(-2 66 152)" />
          <rect x="66" y="158" width="20" height="3.5" rx="1.5" transform="rotate(-2 66 158)" />
          <rect x="60" y="173" width="40" height="3.5" rx="1.5" />
          <rect x="60" y="179" width="26" height="3.5" rx="1.5" />
        </g>
      </QlPrinter>

      <path d="M192 74L250 52" stroke={danger} strokeWidth="2" strokeLinecap="round" />
      <circle cx="274" cy="44" r="26" fill="#1d1d1d" stroke={danger} strokeWidth="2.5" />
      <rect x="271" y="29" width="6" height="21" rx="3" fill={danger} />
      <circle cx="274" cy="58" r="3.4" fill={danger} />
    </Scene>
  )
}

/** Dashboard empty state: the printer is idle and the label reads 0. */
export function NoCheckInsIllustration({ className }: ArtProps) {
  return (
    <Scene label="Printeren står klar, ingen innsjekk ennå" className={className}>
      <QlPrinter x={75} y={4} scale={0.95} lcd={<LcdIdle />}>
        <g transform="translate(43 124)">
          <path d={tornLabel(84, 72)} fill={paper} />
          <text
            x="42"
            y="48"
            textAnchor="middle"
            fill={ink}
            fontSize="34"
            fontWeight="700"
            className="font-display"
          >
            0
          </text>
          <rect x="16" y="58" width="52" height="3" rx="1.5" fill={brand} />
        </g>
      </QlPrinter>
    </Scene>
  )
}
