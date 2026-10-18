/**
 * Badge with a QR code: the code bottom-left, company (line 2) and role
 * (line 3) stacked and centred between it and the duck, the name unchanged.
 *
 * Frames are portrait LBX points like the rest of `badge.lbx`; USB
 * (`renderBadge`) and Smooth Print (`withBadgeQr`) both read them from here.
 */

type PtRect = { x: number; y: number; width: number; height: number }

/** 36 pt (12.7 mm) square in the bottom-left corner as the badge is read. */
export const BADGE_QR_FRAME: PtRect = { x: 6.5, y: 10.3, width: 36, height: 36 }

/** Between the QR code and the duck, level with the code's top half. */
export const BADGE_QR_LINE2_FRAME: PtRect = { x: 20.5, y: 52.1, width: 22, height: 166.8 }
/** Under line 2, level with the code's bottom half. */
export const BADGE_QR_LINE3_FRAME: PtRect = { x: 5.5, y: 52.1, width: 15, height: 166.8 }

export const BADGE_QR_LINE2_FONT = { sizePt: 16, weight: 700 }
export const BADGE_QR_LINE3_FONT = { sizePt: 12, weight: 400 }

/** The QR frame in printer dots (300 dpi). */
export const BADGE_QR_MAX_DOTS = Math.floor((BADGE_QR_FRAME.width * 300) / 72)
