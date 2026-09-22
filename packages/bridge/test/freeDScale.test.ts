/**
 * Zoom/Fokus auf den FreeD-Bereich 0–4095 (#55).
 * Reine Funktionen — keine Optik, keine Steckdose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCurve, unitFromRaw, toFreeDLens, toFreeDLensFromMillivolts,
  UNCALIBRATED, FREED_LENS_MAX, RAW_MAX,
} from '../src/protocol/FreeDScale';

// ── makeCurve ──
test('rejects fewer than two points — one measurement is not a travel', () => {
    assert.equal(makeCurve([]), null);
    assert.equal(makeCurve([{ raw: 0, unit: 0 }]), null);
});

test('sorts by raw so points may be recorded in any order', () => {
    const c = makeCurve([{ raw: 100, unit: 1 }, { raw: 0, unit: 0 }])!;
    assert.deepEqual(c.points.map((p) => p.raw), [0, 100]);
});

test('rejects two different units at the same raw value', () => {
    // Averaging would hide a wrong measurement behind a plausible number.
    assert.equal(makeCurve([{ raw: 50, unit: 0 }, { raw: 50, unit: 1 }]), null);
});

// ── unitFromRaw ──
  const c = makeCurve([
    { raw: 0x0c00, unit: 0 },
    { raw: 0x8000, unit: 0.5 },
    { raw: 0xe200, unit: 1 },
  ])!;

test('clamps below the first and above the last point', () => {
    // Der ganze Grund fuer die Kennlinie: diese Optik erreicht ihren Anschlag
    // bei 0xE200 und meldet darueber nichts. Eine feste Division bildete sie
    // auf einen Bereich ab, den sie nie erreicht.
    assert.equal(unitFromRaw(c, 0), 0);
    assert.equal(unitFromRaw(c, 0xffff), 1);
});

test('interpolates linearly between two points', () => {
    const mitte = (0x0c00 + 0x8000) / 2;
    assert.ok(Math.abs((unitFromRaw(c, mitte)) - (0.25)) < 1e-6);
});

test('hits the measured points exactly', () => {
    assert.equal(unitFromRaw(c, 0x8000), 0.5);
});

// ── toFreeDLens ──
test('gives null for a missing reading, never zero', () => {
    // Null ist eine Aussage (Weitwinkel-Anschlag), fehlend ist keine.
    assert.equal(toFreeDLens(null), null);
});

test('spans the full FreeD range without a curve', () => {
    assert.equal(toFreeDLens(0, UNCALIBRATED), 0);
    assert.equal(toFreeDLens(RAW_MAX, UNCALIBRATED), FREED_LENS_MAX);
});

test('never leaves 0..4095, even with a curve that overshoots', () => {
    const wild = makeCurve([{ raw: 0, unit: -2 }, { raw: 100, unit: 3 }])!;
    assert.equal(toFreeDLens(0, wild), 0);
    assert.equal(toFreeDLens(100, wild), FREED_LENS_MAX);
});

test('follows a measured curve instead of the encoder span', () => {
    const c = makeCurve([{ raw: 0x0c00, unit: 0 }, { raw: 0xe200, unit: 1 }])!;
    // Am mechanischen Anschlag der Optik steht 4095 — bei fester Division
    // waere hier 57855/65535 * 4095 = 3615 herausgekommen.
    assert.equal(toFreeDLens(0xe200, c), FREED_LENS_MAX);
    assert.equal(toFreeDLens(0x0c00, c), 0);
});

// ── toFreeDLensFromMillivolts ──
test('nimmt die 2-7-V-Spanne als Vorgabe', () => {
    assert.equal(toFreeDLensFromMillivolts(2000), 0);
    assert.equal(toFreeDLensFromMillivolts(7000), FREED_LENS_MAX);
    assert.equal(toFreeDLensFromMillivolts(4500), Math.round(0.5 * FREED_LENS_MAX));
});
