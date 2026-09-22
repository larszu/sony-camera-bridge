/**
 * Mapping raw lens positions onto the FreeD zoom/focus range (#55).
 *
 * ── Why this is not a one-liner ────────────────────────────────────────────
 *
 * Three ranges meet here, and none of them agree:
 *
 *     serial 0x31 / 0x32      0x0000–0xFFFF   (zoom wide→tele, focus MOD→inf)
 *     analogue pin 10 / 11    2–7 V
 *     FreeD                   0–4095
 *
 * The obvious move is `raw * 4095 / 65535`. It is also wrong, for a reason
 * that only shows up on real glass: `0x0000`–`0xFFFF` is the range of the
 * ENCODER, not of the lens. A given lens may reach its mechanical stop at
 * 0xE200 and report nothing beyond; another may never go below 0x0C00. A
 * fixed division maps both onto a range they never occupy, and the receiving
 * engine sees a lens that cannot reach either end.
 *
 * So the mapping goes through a curve, the same way the iris does. Without a
 * recorded curve, the endpoints are the full encoder range — which is the
 * honest default: it is what the protocol says, and it is visibly wrong in a
 * way that a recorded curve fixes.
 *
 * ── What a curve is here ───────────────────────────────────────────────────
 *
 * A short list of (raw, unit) pairs measured on the actual lens, sorted by
 * raw. Between two points the mapping is linear; outside the outermost points
 * it clamps. Two points is a straight line and already better than a guess;
 * five points follow a non-linear zoom ring closely enough for tracking.
 *
 * `unit` is deliberately NOT millimetres or metres. 0x14/0x15 report the focal
 * lengths at tele and wide, 0x16 the minimum object distance — with those, a
 * caller can build a curve in physical units and this module will carry it
 * through unchanged. Without them, `unit` is a normalised 0..1 position along
 * the mechanical travel, which is all FreeD needs.
 *
 * Pure functions. No device, no I/O.
 */

/** FreeD carries zoom and focus in 24 bits, but consumers expect 0–4095. */
export const FREED_LENS_MAX = 4095;

/** Full span of the serial position reports 0x31 / 0x32. */
export const RAW_MIN = 0x0000;
export const RAW_MAX = 0xffff;

/** One measured point of a lens curve. */
export interface CurvePoint {
  /** What the lens reported, in its own units (0x0000–0xFFFF, or millivolts). */
  raw: number;
  /**
   * Where that sits along the mechanical travel, 0..1.
   *
   * 0 is one mechanical stop, 1 the other. Which end is which is the caller's
   * business: zoom runs wide→tele, focus MOD→infinity, and a lens mounted on
   * a B4 adapter may run either way round.
   */
  unit: number;
}

/**
 * A lens curve, or the absence of one.
 *
 * `points` shorter than two is not a curve. It is returned as `null` from
 * `makeCurve` rather than silently treated as a straight line through one
 * point — a single measurement says where one position is, not how the travel
 * behaves.
 */
export interface LensCurve {
  points: readonly CurvePoint[];
}

/**
 * Builds a curve, or says why it is not one.
 *
 * Sorting happens here so callers may record points in any order; duplicate
 * raw values are rejected rather than averaged, because two different units
 * at the same raw value mean the measurement is wrong and averaging hides it.
 */
export function makeCurve(points: readonly CurvePoint[]): LensCurve | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.raw - b.raw);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].raw === sorted[i - 1].raw) return null;
  }
  for (const p of sorted) {
    if (!Number.isFinite(p.raw) || !Number.isFinite(p.unit)) return null;
  }
  return { points: sorted };
}

/** Position along the travel (0..1) for a raw reading, clamped at both ends. */
export function unitFromRaw(curve: LensCurve, raw: number): number {
  const p = curve.points;
  if (raw <= p[0].raw) return p[0].unit;
  if (raw >= p[p.length - 1].raw) return p[p.length - 1].unit;
  for (let i = 1; i < p.length; i += 1) {
    if (raw <= p[i].raw) {
      const a = p[i - 1];
      const b = p[i];
      const t = (raw - a.raw) / (b.raw - a.raw);
      return a.unit + t * (b.unit - a.unit);
    }
  }
  return p[p.length - 1].unit;
}

/**
 * The fallback used when nobody has measured the lens.
 *
 * The full encoder span mapped linearly. It is what the protocol documents,
 * and it is wrong in a visible way on real glass — the lens will appear not
 * to reach its stops. That is the intended failure mode: a plausible-looking
 * wrong number is worse than an obviously wrong one.
 */
export const UNCALIBRATED: LensCurve = {
  points: [
    { raw: RAW_MIN, unit: 0 },
    { raw: RAW_MAX, unit: 1 },
  ],
};

/**
 * Raw lens reading → FreeD 0–4095.
 *
 * Returns null for a missing reading. FreeD has no way to say "unknown", and
 * this module will not invent a zero for one — the caller decides whether to
 * send a packet at all. That is the same rule `encodeFreeD` follows.
 */
export function toFreeDLens(raw: number | null, curve: LensCurve = UNCALIBRATED): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  const unit = unitFromRaw(curve, raw);
  const clamped = Math.min(1, Math.max(0, unit));
  return Math.round(clamped * FREED_LENS_MAX);
}

/**
 * Millivolts from the analogue position pins → FreeD 0–4095.
 *
 * Separate entry point on purpose. The analogue path reports 2–7 V, and those
 * endpoints are UNVERIFIED — they come from a pinout description, not from a
 * measurement on this lens. Anyone passing a curve here has measured; anyone
 * relying on the default has not, and the two should not look alike at the
 * call site.
 */
export function toFreeDLensFromMillivolts(
  mv: number | null,
  curve: LensCurve = ANALOG_DEFAULT,
): number | null {
  return toFreeDLens(mv, curve);
}

/** 2–7 V as millivolts. PROVISIONAL — see `toFreeDLensFromMillivolts`. */
export const ANALOG_DEFAULT: LensCurve = {
  points: [
    { raw: 2000, unit: 0 },
    { raw: 7000, unit: 1 },
  ],
};
