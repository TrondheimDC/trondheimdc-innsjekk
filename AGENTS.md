# TDC Innsjekk

Staff UI is Norwegian bokmål. Keep established product words: printer, Smooth Print, P-touch Editor, QR, MAC.

## Forms → Zod → database

Admin forms use **React Hook Form** with **`zodResolver`** and the same Zod schemas that gate API bodies / Drizzle writes (`src/lib/db/schema.ts`).

- Define the shape once in Zod (aligned with the Drizzle table).
- Wire the form with `useForm({ resolver: zodResolver(schema), … })`.
- Parse again on the server with that schema before insert/update.
- Do not hand-roll parallel validation that can drift from the DB.

## Admin CRUD

Reuse the inventory pattern. Do not invent a second way to load, mutate, or delete resources.

### List

- Server-load in the page RSC, seed TanStack Query (`setQueryData` / `HydrationBoundary`).
- Client list reads the same query key. No “Henter…” flash before the first paint.

### Create / upload

- One upload surface (dropzone **or** button — not both). Selecting/dropping a file may start the upload; do not stack a second “Last opp” CTA next to the dropzone.
- Large files (e.g. APK): show real upload progress (name, bar, percent / bytes). Use XHR if `fetch` cannot report progress. Accept `.apk` or a `.zip` with one `.apk`; unpack on the server and store the APK. Serve only `.apk` to phones.
- On success: `setQueryData` to prepend/update the cache, then `invalidateQueries`.

### Update

- `useMutation` with optimistic `setQueryData`, roll back on error, `invalidateQueries` on settle.
- Keep activate / deactivate (and similar toggles) as ordinary buttons — not confirm dialogs.

### Delete (destructive)

Match `RemovePrinterButton` (`src/components/admin/remove-printer.tsx`):

- Danger-styled ghost trigger (`text-[var(--color-bg-danger)]` + danger hover mix).
- Confirm in `Dialog`: short title (“Fjerne …?” / “Slette …?”), one-line consequence, danger confirm + **Avbryt** (`variant="surface"`). Name the resource in the body; keep the confirm button short (“Slett” / “Fjern …”) so long filenames do not overflow (`whitespace-nowrap` on buttons). Use `break-all` for APK/file names.
- Close the dialog in `onMutate`, optimistically remove from the query cache, restore on error, invalidate on settle.
- Put delete behind its own small component when the list row already has other actions — same shape as printers.

Reference implementations: printers inventory + `RemovePrinterButton`; Smooth Print inventory + `RemoveSmoothPrintApkButton`.

## No pop-in

The first paint of a screen is the real screen.

- Load the data on the server when the page needs it. Do not render “Henter…” and then swap in the list. Prefer TanStack Query with server hydration / `setQueryData` from the RSC payload.
- Mutations use `useMutation` and update the query cache (`invalidateQueries` / optimistic `setQueryData`). Do not hand-roll `busy` + `fetch` + `router.refresh` for resource CRUD.
- Empty, error, and ready states each have a stable layout. An empty state is an illustration, a short heading, and one action. It is not a leftover sentence.
- If something must arrive later, reserve its box. Do not grow the page when it appears.

## Setup URLs (`/oppsett`)

Keep the address bar in sync with the wizard so staff can refresh and deeplink.

- Query: `step` (`install` | `camera` (iOS) | `bt-on` | `scan` | `connect` | `pair` (iOS) | `select` (Android) | `confirm` | `test-print`), optional `path` (`qr` | `manual`), `primed=1` after the prelude, `printer` (inventory id; older stickers: `address`, `serial`, `model`, `type`). No connect callbacks (`connectcallback` omitted). Optional `connectdebug=1` while testing to attach `connectcallback` and surface `result=`.
- Update with `history.replaceState` (not `router.replace`) so each step change does not remount the client flow.
- Help subpages link back to a concrete step (`/oppsett?step=pair&primed=1`, `/oppsett?step=install&primed=1`) — not `history.back()`.
- Resume: honor `step` when present; a fresh sticker deeplink (`step=connect` / later without `primed`) still starts at install → BT-on, then resumes.
- Front sticker QRs use `printerStickerSetupPath(id)` → `/oppsett/prt_…` (short, so a coarser QR), which redirects to `printerSetupPath(id)` → `/oppsett?printer=<id>`; `/oppsett` looks up the fields, so a sticker survives address / connection changes. No `step` on an id sticker means `path=qr&step=connect` (skips in-app scan). Keep parsing the older field stickers.
- Login sticker QRs use `printerStickerLoginPath(token)` → `/logg-inn/lgn_…`, which redirects to `/logg-inn?token=lgn_…`. Ids shown to people (URLs, stickers, screens) always keep their prefix (`prt_`, `lgn_`).
- A logged-out scan goes to `/logg-inn?next=…` (proxy, or `requireDoorSession` via the `x-door-path` header) and returns there after the in-app QR scan + PIN.
- Happy path: install → printer Bluetooth on → **Skann QR** (Start kamera) → Smooth Print `connect` → test print. **iOS inserts OS Bluetooth pair before connect** (MFi). Fallback from scan: **Manuelt oppsett** → iOS: OS Bluetooth pair → select in Smooth Print; Android: connect via Bluetooth inside Smooth Print (no OS pair) → confirm against a screenshot of the connected state → test print.
- Android connect `serialnum`/`model` use the stored barcode serial and `QL-820NWBc`. iOS connect uses last-9 serial and `QL-820NWB` (matches Smooth Print’s paired list).
- Android checks in through the TDC Innsjekk app (`docs/android-app.md`): no Smooth Print. In the app, `/oppsett` is `bt-on` → `scan` (or `select`) → `connect` → `test-print`, printing over Bluetooth. While the app is the active APK (Admin → Android-app), Android browsers are sent to `/last-ned` after login; activating a Smooth Print APK, or none, rolls Android back to the Smooth Print steps above.
- PC/Mac (not iOS/Android) get the USB wizard instead: `step` = `usb` | `driver` | `connect` | `test-print`. The OS comes from the UA: `driver` is Zadig on Windows, a udev rule on Linux, and skipped on Mac. WebUSB in Chrome/Edge; no Smooth Print.
- Android: after install, press Ferdig — do **not** open Smooth Print. A cold start on connect asks for permissions/terms, then returns to the browser. Force-close only before test print so the overlay dialog appears.

## Browser defaults

Do not switch off native browser behavior: swipe back/forward, pull-to-refresh, pinch zoom, text selection, scroll bounce. No `overscroll-behavior`, `touch-action: none`, `user-scalable=no`, or touch `preventDefault` on page-level elements. Fix the specific layout bug instead.

## Interactive controls

Use the shared `Button` (`src/components/ui/button.tsx`) for anything staff should tap — including choice cards, not only primary CTAs.

- Affordance lives on `Button`: `cursor-pointer`, hover/active surface mix, focus ring, press scale (`btn-press`). A bare `<button>` with only `bg-[var(--color-bg-surface)]` reads as a dead panel.
- Choice / option tiles: `variant="surface"` plus layout overrides (`h-auto`, `items-start`, `justify-start`, `text-left`, `whitespace-normal`). Do not reimplement surface hover by hand.
- Raw `<button>` is fine only when the control is not meant to look like an action (e.g. a labeled checkbox row), or when you deliberately match an existing non-Button pattern already in the app.

## Copy

Write labels the way the rest of the app speaks. “Deltakere”, not “Import attendees”. “Ny printer”, not “New printer” and not “skriver”.
Keep blurb text short and useful — not a dump of paper sizes and protocol details.
