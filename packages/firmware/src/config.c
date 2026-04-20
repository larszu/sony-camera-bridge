/**
 * Device Configuration — Flash Storage Implementation
 */

#include "config.h"
#include "W7500x.h"
#include <string.h>

/* Simple CRC32 (no table, compact for Cortex-M0) */
static uint32_t crc32_calc(const uint8_t *data, uint32_t len)
{
    uint32_t crc = 0xFFFFFFFF;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            if (crc & 1)
                crc = (crc >> 1) ^ 0xEDB88320;
            else
                crc >>= 1;
        }
    }
    return ~crc;
}

/* ── Default MAC: WIZnet OUI + "SB" + 00 ──────────────────── */
static const uint8_t default_mac[6] = { 0x00, 0x08, 0xDC, 0x53, 0x42, 0x00 };

void config_defaults(device_config_t *cfg)
{
    memset(cfg, 0, sizeof(*cfg));
    cfg->magic = CONFIG_MAGIC;

    memcpy(cfg->mac, default_mac, 6);

    /* DHCP enabled by default */
    cfg->dhcp_enable = 1;
    cfg->local_ip[0] = 192; cfg->local_ip[1] = 168;
    cfg->local_ip[2] = 1;   cfg->local_ip[3] = 100;
    cfg->subnet[0] = 255; cfg->subnet[1] = 255;
    cfg->subnet[2] = 255; cfg->subnet[3] = 0;
    cfg->gateway[0] = 192; cfg->gateway[1] = 168;
    cfg->gateway[2] = 1;   cfg->gateway[3] = 1;

    /* TCP bridge: server mode on port 7700 */
    cfg->mode       = MODE_SERVER;
    cfg->local_port = 7700;
    cfg->peer_port  = 7700;

    /* Sony RS-422: 38400 8O1 */
    cfg->baudrate  = 38400;
    cfg->parity    = PARITY_ODD;
    cfg->data_bits = 8;
    cfg->stop_bits = 1;

    cfg->checksum = crc32_calc((const uint8_t *)cfg,
                               sizeof(*cfg) - sizeof(cfg->checksum));
}

void config_load(device_config_t *cfg)
{
    const device_config_t *flash =
        (const device_config_t *)CONFIG_FLASH_ADDR;

    if (flash->magic != CONFIG_MAGIC) {
        config_defaults(cfg);
        config_save(cfg);
        return;
    }

    uint32_t expected = crc32_calc((const uint8_t *)flash,
                                   sizeof(*flash) - sizeof(flash->checksum));
    if (expected != flash->checksum) {
        config_defaults(cfg);
        config_save(cfg);
        return;
    }

    memcpy(cfg, flash, sizeof(*cfg));
}

void config_save(const device_config_t *cfg)
{
    device_config_t tmp;
    memcpy(&tmp, cfg, sizeof(tmp));
    tmp.checksum = crc32_calc((const uint8_t *)&tmp,
                              sizeof(tmp) - sizeof(tmp.checksum));

    /*
     * W7500P flash programming:
     * 1. Unlock flash
     * 2. Erase page (1KB)
     * 3. Program words
     * 4. Lock flash
     */
    volatile uint32_t *flash_addr = (volatile uint32_t *)CONFIG_FLASH_ADDR;
    const uint32_t *src = (const uint32_t *)&tmp;
    uint32_t words = (sizeof(tmp) + 3) / 4;

    /* Unlock */
    *(volatile uint32_t *)0x41004000 = 0x1ACCE551;  /* IAP enable key */

    /* Erase page */
    *(volatile uint32_t *)0x41004004 = CONFIG_FLASH_ADDR;
    *(volatile uint32_t *)0x41004008 = 0x00;  /* Page erase command */
    *(volatile uint32_t *)0x4100400C = 0x01;  /* Start */
    while (*(volatile uint32_t *)0x41004010 & 0x01)
        ;  /* Wait for completion */

    /* Program */
    for (uint32_t i = 0; i < words; i++) {
        flash_addr[i] = src[i];
    }

    /* Lock */
    *(volatile uint32_t *)0x41004000 = 0x00;
}
