/**
 * FreeD-Sender über UDP (#54).
 *
 * Gegen einen ECHTEN Socket auf 127.0.0.1 und nicht gegen einen Mock: was
 * hier interessiert, ist ob ein gültiges Paket wirklich das Netz erreicht.
 * Ein Mock der Steckdose hätte genau das nicht gezeigt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocket, type Socket } from 'node:dgram';

import { FreeDSender, FREED_DEFAULT_PORT } from '../src/transport/FreeDSender';
import { isValidFreeDPacket, decodeFreeD, type FreeDSample } from '../src/protocol/FreeD';

const vollstaendig = (): FreeDSample => ({
  cameraId: 3,
  panDeg: 12.5,
  tiltDeg: -3.25,
  rollDeg: 0,
  xMm: 1000,
  yMm: -500,
  zMm: 1500,
  zoom: 2048,
  focus: 1024,
});

/** Ein Empfänger, der wirklich lauscht. */
async function empfaenger(): Promise<{ sock: Socket; port: number; pakete: Buffer[] }> {
  const sock = createSocket('udp4');
  const pakete: Buffer[] = [];
  sock.on('message', (m) => pakete.push(Buffer.from(m)));
  const port = await new Promise<number>((res) => {
    sock.bind(0, '127.0.0.1', () => res((sock.address() as { port: number }).port));
  });
  return { sock, port, pakete };
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('schickt gueltige D1-Pakete an die eingestellte Adresse', async () => {
  const { sock, port, pakete } = await empfaenger();
  const s = new FreeDSender({ host: '127.0.0.1', port, rateHz: 200, sample: vollstaendig });
  s.start();
  await warte(120);
  s.stop();
  sock.close();

  assert.ok(pakete.length > 3, `nur ${pakete.length} Pakete`);
  assert.equal(isValidFreeDPacket(pakete[0]), true);
  const d = decodeFreeD(pakete[0])!;
  assert.equal(d.cameraId, 3);
  assert.equal(d.zoom, 2048);
});

test('schickt NICHTS, wenn eine Achse fehlt — und sagt welche', async () => {
  // Der Kern des Issues: eine Null ist eine Aussage („zeigt geradeaus"), ein
  // fehlender Wert ist keine. Stille ist das ehrliche Signal, und jeder
  // Tracking-Abnehmer kommt mit einer Luecke zurecht.
  const { sock, port, pakete } = await empfaenger();
  const gesehen: string[][] = [];
  const s = new FreeDSender({
    host: '127.0.0.1',
    port,
    rateHz: 200,
    sample: () => ({ ...vollstaendig(), panDeg: null }),
    onSkip: (m) => gesehen.push([...m]),
  });
  s.start();
  await warte(80);
  s.stop();
  sock.close();

  assert.equal(pakete.length, 0);
  assert.ok(gesehen.length > 0, 'kein Skip gemeldet');
  assert.ok(gesehen[0].includes('panDeg'));
  assert.ok(s.getStats().skipped > 0);
  assert.equal(s.getStats().sent, 0);
});

test('haelt die eingestellte Rate ungefaehr ein', async () => {
  const { sock, port, pakete } = await empfaenger();
  const s = new FreeDSender({ host: '127.0.0.1', port, rateHz: 50, sample: vollstaendig });
  s.start();
  await warte(400);
  s.stop();
  sock.close();

  // 50 Hz ueber 400 ms sind rund 20 Pakete. Grosszuegige Grenzen mit Absicht:
  // ein Test, der auf einem ausgelasteten Rechner rot wird, misst die
  // Auslastung und nicht den Sender.
  assert.ok(pakete.length > 8, `nur ${pakete.length}`);
  assert.ok(pakete.length < 40, `schon ${pakete.length}`);
});

test('startet nicht zweimal', () => {
  const s = new FreeDSender({ host: '127.0.0.1', port: FREED_DEFAULT_PORT, sample: () => null });
  s.start();
  s.start();
  s.stop();
  assert.equal(s.getStats().sent, 0);
});
