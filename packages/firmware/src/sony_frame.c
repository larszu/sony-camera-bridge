/**
 * Sony 700PTP Frame Detector — Implementation
 */

#include "sony_frame.h"
#include <string.h>

/* ── Helpers ────────────────────────────────────────────────────── */

/**
 * Check if a byte is a valid Sony 700PTP header.
 * This prevents the frame parser from locking onto garbage data.
 */
static uint8_t is_valid_header(uint8_t b)
{
    switch (b) {
    case HDR_HANDSHAKE:
    case HDR_HANDSHAKE_RESP:
    case HDR_HANDSHAKE_ACK:
    case HDR_HEARTBEAT:
    case HDR_HEARTBEAT_ACK:
    case HDR_NOTIFY:
    case HDR_NOTIFY_ACK:
    case HDR_MESSAGE:
    case HDR_MESSAGE_RESP:
    case HDR_CLOSE:
    case HDR_CLOSE_ACK:
        return 1;
    default:
        return 0;
    }
}

/* ── Public API ─────────────────────────────────────────────────── */

void sony_frame_init(sony_frame_ctx_t *ctx)
{
    ctx->state     = FRAME_IDLE;
    ctx->header    = 0;
    ctx->size      = 0;
    ctx->collected = 0;
    ctx->buf_len   = 0;
}

uint16_t sony_frame_feed(sony_frame_ctx_t *ctx,
                         uint8_t byte,
                         uint8_t *out_buf,
                         uint16_t out_max)
{
    switch (ctx->state)
    {
    case FRAME_IDLE:
        if (is_valid_header(byte)) {
            ctx->header   = byte;
            ctx->buf[0]   = byte;
            ctx->buf_len  = 1;
            ctx->state    = FRAME_GOT_HEADER;
        }
        /* else: skip non-header bytes (re-sync) */
        return 0;

    case FRAME_GOT_HEADER:
        ctx->size     = byte;
        ctx->buf[1]   = byte;
        ctx->buf_len  = 2;
        ctx->collected = 0;

        if (ctx->size == 0) {
            /* Zero-payload frame (e.g., HeartBeatACK, CloseACK) */
            goto frame_complete;
        }

        /* Sanity check: reject absurdly large frames */
        if (ctx->size > (FRAME_MAX_SIZE - 2)) {
            sony_frame_init(ctx);
            return 0;
        }

        ctx->state = FRAME_COLLECTING;
        return 0;

    case FRAME_COLLECTING:
        if (ctx->buf_len < FRAME_MAX_SIZE) {
            ctx->buf[ctx->buf_len++] = byte;
        }
        ctx->collected++;

        if (ctx->collected >= ctx->size) {
            goto frame_complete;
        }
        return 0;
    }

    return 0;

frame_complete:
    {
        uint16_t len = ctx->buf_len;
        if (len > out_max) len = out_max;
        memcpy(out_buf, ctx->buf, len);
        sony_frame_init(ctx);
        return len;
    }
}

uint16_t sony_frame_flush(sony_frame_ctx_t *ctx,
                          uint8_t *out_buf,
                          uint16_t out_max)
{
    if (ctx->buf_len == 0 || ctx->state == FRAME_IDLE) {
        sony_frame_init(ctx);
        return 0;
    }

    uint16_t len = ctx->buf_len;
    if (len > out_max) len = out_max;
    memcpy(out_buf, ctx->buf, len);
    sony_frame_init(ctx);
    return len;
}
