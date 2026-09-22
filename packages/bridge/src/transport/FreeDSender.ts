import { createSocket, type Socket } from 'node:dgram';
import { encodeFreeD, type FreeDSample } from '../protocol/FreeD';

/**
 * Sends FreeD D1 packets over UDP (#54).
 *
 * The encoder next door is a pure function on purpose; this is the one place
 * that owns a socket and a timer.
 *
 * ── Why it pulls instead of being pushed ───────────────────────────────────
 *
 * A tracking consumer expects a steady stream at a fixed rate. The lens and
 * the head do not update at that rate — they update when they feel like it,
 * and a serial reply may be late or missing. Pushing every reading straight
 * out gives a jittery stream at an unpredictable rate; a receiver that
 * interpolates will interpolate the jitter.
 *
 * So the sender asks: every tick it calls `sample()`, gets the current state,
 * and emits one packet. Between ticks the caller may update the state as
 * often or as rarely as it likes.
 *
 * ── What it refuses to do ──────────────────────────────────────────────────
 *
 * It does not fill in missing axes. `encodeFreeD` returns a list of missing
 * fields instead of a packet, and this sender then sends NOTHING and counts
 * the skip. A receiving engine that gets pan 0 believes the camera points
 * straight ahead; silence is the honest signal for "nobody measured it", and
 * every tracking consumer already handles a gap.
 */
export interface FreeDSenderOptions {
  host: string;
  port: number;
  /**
   * Packets per second.
   *
   * 25 by default — one per frame at the rate broadcast here runs on. FreeD
   * carries no timestamp, so the receiver pairs packets with frames by
   * arrival; sending faster than the frame rate gives it more to discard,
   * sending slower makes it interpolate.
   */
  rateHz?: number;
  /** Where the current state comes from. Called once per tick. */
  sample: () => FreeDSample | null;
  /** Optional: told about every skipped tick and why. */
  onSkip?: (missing: readonly string[]) => void;
  onError?: (err: Error) => void;
}

export const FREED_DEFAULT_PORT = 6301;
export const FREED_DEFAULT_RATE_HZ = 25;

export interface FreeDSenderStats {
  sent: number;
  /** Ticks that produced no packet because an axis was missing. */
  skipped: number;
  lastMissing: readonly string[];
}

export class FreeDSender {
  private socket: Socket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly stats: FreeDSenderStats = { sent: 0, skipped: 0, lastMissing: [] };

  constructor(private readonly options: FreeDSenderOptions) {}

  start(): void {
    if (this.timer) return;
    this.socket = createSocket('udp4');
    this.socket.on('error', (err) => this.options.onError?.(err));
    // Unref: ein Sender, der laeuft, soll den Prozess nicht am Leben halten.
    // Sonst haengt ein Kommandozeilen-Werkzeug nach getaner Arbeit.
    this.socket.unref();

    const hz = this.options.rateHz ?? FREED_DEFAULT_RATE_HZ;
    const ms = Math.max(1, Math.round(1000 / hz));
    this.timer = setInterval(() => this.tick(), ms);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.socket) { this.socket.close(); this.socket = null; }
  }

  getStats(): Readonly<FreeDSenderStats> {
    return { ...this.stats, lastMissing: [...this.stats.lastMissing] };
  }

  private tick(): void {
    const s = this.options.sample();
    if (!s) { this.stats.skipped += 1; return; }
    const result = encodeFreeD(s);
    if (!result.ok) {
      this.stats.skipped += 1;
      this.stats.lastMissing = result.missing;
      this.options.onSkip?.(result.missing);
      return;
    }
    this.socket?.send(result.packet, this.options.port, this.options.host, (err) => {
      if (err) this.options.onError?.(err);
      else this.stats.sent += 1;
    });
  }
}
