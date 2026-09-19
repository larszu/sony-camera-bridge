# FreeD output

Tracking data leaves the bridge as FreeD D1 datagrams over UDP. FreeD comes
from BBC R&D and is read by, among others, Unreal Engine through Live Link.

Two files, deliberately separate:

| File | Does | Does not |
|---|---|---|
| `packages/bridge/src/protocol/FreeD.ts` | builds and parses the 29 bytes | open a socket, keep a clock |
| `packages/bridge/src/transport/FreeDSender.ts` | destination, rate, what a tick does | decide what a byte means |

## The packet

29 bytes, big-endian throughout, checksum `(0x40 − sum of bytes 0..27) & 0xFF`.
The field table is in the head of `FreeD.ts` and is not copied here — a second
copy of a byte table is the kind of thing that drifts silently.

**What is verified and what is not.** Length, identifier, checksum rule and the
angle format (sign in bit 23, 8 integer and 15 fractional bits, i.e. 1/32768
degree) come from public sources. The position scale `POSITION_UNITS_PER_MM =
64` is the widely used value but **not confirmed** against an authoritative
document; issue #54 stays open for exactly that check. Angles, zoom and focus
are unaffected, so a lens that only reports zoom and focus is already fully
covered.

## Configuring the sender

```ts
import { createFreeDSender } from './transport/FreeDSender.js';

const sender = createFreeDSender({
  host: '10.0.1.50',   // unicast, broadcast or multicast
  port: 6301,          // whatever the receiving system was set to
  rateHz: 50,          // packets per second
  onIncomplete: (missing) => log.warn(`FreeD: no ${missing.join(', ')} yet`),
  onError: (err) => log.error(err),
});

sender.update(sample);   // store the latest tracking sample
sender.start();          // begin ticking
```

### Address, port and rate have no defaults

All three are required, and `createFreeDSender` throws rather than filling one
in.

- **FreeD has no registered UDP port.** Whoever sets a system up tells each end
  which port to use. The numbers that circulate — 6301 is the common one — are
  site conventions, not a specification. A default here would look like a
  standard and would not be one, and the first person to hit it would debug a
  silent receiver instead of reading an error message.
- **The rate belongs to the installation, not to the protocol.** Tracking is
  normally sent once per video field or frame, which makes 25, 50 and 60 Hz the
  usual choices; which one is right depends on the format the show runs in, and
  this program does not know that. `intervalMs` on the sender reports the
  derived tick spacing (`1000 / rateHz`) so a caller can show what it settled
  on.

A rate that is not a positive finite number, and a port outside 1..65535, are
rejected instead of repaired.

### A tick with nothing to say sends nothing

`encodeFreeD` refuses a sample with a null axis, and the sender does not work
around that:

| Situation | On the wire | Counter | Callback |
|---|---|---|---|
| complete sample | one datagram | `sent` | — |
| an axis is `null` | nothing | `skippedIncomplete` | `onIncomplete(missing)` |
| no sample yet | nothing | `skippedNoSample` | — |
| socket error | — | `errors` | `onError(err)` |

Zero-filling a missing axis would put the camera at the origin pointing
straight ahead — a statement nobody made, and one the receiver cannot tell from
a measurement. Silence is the honest report of "no tracking yet".

`sendNow()` sends a single packet outside the tick, opening and closing its own
socket, and returns `{ ok: false, reason }` with the same three cases. It is
there so someone checking a route gets an answer rather than a guess.

## Tests

`packages/bridge/test/freeD.test.ts` covers the bytes,
`packages/bridge/test/freeDSender.test.ts` the wire — the latter binds a real
loopback receiver on a kernel-chosen port, because a mocked `send()` would only
prove that a function was called.

Neither proves byte-exactness against a capture from real FreeD equipment. That
capture does not exist here, and issue #54 names it as the remaining item.
