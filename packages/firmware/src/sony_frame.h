/**
 * Sony 700PTP Frame Detector
 *
 * Detects Sony 700PTP/SPP frame boundaries in a byte stream.
 *
 * Sony 700PTP frame format:
 *   Byte 0: HEADER  (packet type identifier)
 *   Byte 1: SIZE    (number of payload bytes following)
 *   Byte 2..N: PAYLOAD (SIZE bytes)
 *
 * Total frame length = 2 + SIZE
 *
 * Known header values:
 *   0x02 = HandShake
 *   0x03 = HandShakeResponse
 *   0x04 = HandShakeACK
 *   0x08 = HeartBeat
 *   0x09 = HeartBeatACK
 *   0x0a = Notify
 *   0x0b = NotifyACK
 *   0x0e = Message
 *   0x0f = MessageResponse
 *   0x10 = Close
 *   0x11 = CloseACK
 */

#ifndef SONY_FRAME_H
#define SONY_FRAME_H

#include <stdint.h>

#define FRAME_TIMEOUT_MS    5       /* Flush partial frame after 5ms idle */
#define FRAME_MAX_SIZE      512     /* Maximum expected frame size        */

/* Valid Sony 700PTP header bytes */
#define HDR_HANDSHAKE       0x02
#define HDR_HANDSHAKE_RESP  0x03
#define HDR_HANDSHAKE_ACK   0x04
#define HDR_HEARTBEAT       0x08
#define HDR_HEARTBEAT_ACK   0x09
#define HDR_NOTIFY          0x0a
#define HDR_NOTIFY_ACK      0x0b
#define HDR_MESSAGE         0x0e
#define HDR_MESSAGE_RESP    0x0f
#define HDR_CLOSE           0x10
#define HDR_CLOSE_ACK       0x11

typedef enum {
    FRAME_IDLE = 0,     /* Waiting for header byte    */
    FRAME_GOT_HEADER,   /* Have header, need size     */
    FRAME_COLLECTING     /* Collecting payload bytes   */
} frame_state_t;

typedef struct {
    frame_state_t state;
    uint8_t       header;
    uint8_t       size;
    uint16_t      collected;
    uint8_t       buf[FRAME_MAX_SIZE];
    uint16_t      buf_len;
} sony_frame_ctx_t;

/**
 * Initialize/reset frame context.
 */
void sony_frame_init(sony_frame_ctx_t *ctx);

/**
 * Feed one byte into the frame detector.
 *
 * Returns: number of bytes written to out_buf (0 = no complete frame yet,
 *          >0 = complete frame copied to out_buf).
 *
 * When a complete frame is detected, it is copied to out_buf and the
 * context resets to IDLE. The caller should send out_buf[0..return_value-1]
 * as a single TCP segment / UART burst.
 */
uint16_t sony_frame_feed(sony_frame_ctx_t *ctx,
                         uint8_t byte,
                         uint8_t *out_buf,
                         uint16_t out_max);

/**
 * Flush any partial frame data (timeout recovery).
 *
 * Returns: number of bytes written to out_buf.
 * Resets context to IDLE.
 */
uint16_t sony_frame_flush(sony_frame_ctx_t *ctx,
                          uint8_t *out_buf,
                          uint16_t out_max);

#endif /* SONY_FRAME_H */
