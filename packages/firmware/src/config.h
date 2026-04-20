/**
 * Device Configuration
 *
 * Stored in the last 1KB page of W7500P flash.
 * Configurable via WIZnet-compatible UDP protocol (port 5000)
 * or via our Bridge software discovery.
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <stdint.h>

/* ── Operating Modes ────────────────────────────────────────── */
#define MODE_SERVER     0   /* Camera side: listens for connections  */
#define MODE_CLIENT     1   /* RCP side: connects to camera bridge   */

/* ── Parity ─────────────────────────────────────────────────── */
#define PARITY_NONE     0
#define PARITY_ODD      1
#define PARITY_EVEN     2

/* ── Socket Numbers ─────────────────────────────────────────── */
#define SOCK_BRIDGE     0   /* Main data bridge socket   */
#define SOCK_CONFIG     6   /* UDP configuration socket  */
#define SOCK_DHCP       7   /* DHCP client socket        */

/* ── Flash Storage ──────────────────────────────────────────── */
#define CONFIG_FLASH_ADDR   0x0001FC00  /* Last 1KB page */
#define CONFIG_MAGIC        0x53425247  /* "SBRG" */

/* ── Firmware Identity ──────────────────────────────────────── */
#define FW_VERSION_MAJOR    1
#define FW_VERSION_MINOR    0
#define FW_VERSION_PATCH    0
#define FW_IDENT            "SONY-BRIDGE"

typedef struct __attribute__((packed)) {
    uint32_t magic;             /* CONFIG_MAGIC if valid         */

    /* Network */
    uint8_t  mac[6];
    uint8_t  local_ip[4];
    uint8_t  subnet[4];
    uint8_t  gateway[4];
    uint8_t  dns[4];
    uint8_t  dhcp_enable;

    /* TCP bridge */
    uint8_t  mode;              /* MODE_SERVER or MODE_CLIENT    */
    uint16_t local_port;        /* Default: 7700                 */
    uint8_t  peer_ip[4];        /* For MODE_CLIENT: target IP    */
    uint16_t peer_port;         /* For MODE_CLIENT: target port  */

    /* Serial (Sony 8-pin RS-422) */
    uint32_t baudrate;          /* Default: 38400                */
    uint8_t  parity;            /* PARITY_ODD for Sony           */
    uint8_t  data_bits;         /* 8                             */
    uint8_t  stop_bits;         /* 1                             */

    /* Reserved for future use */
    uint8_t  reserved[32];

    uint32_t checksum;          /* CRC32 of above fields         */
} device_config_t;

/**
 * Load config from flash. If flash is empty/corrupt,
 * initializes with Sony-compatible defaults.
 */
void config_load(device_config_t *cfg);

/**
 * Save config to flash.
 */
void config_save(const device_config_t *cfg);

/**
 * Set defaults: 38400/8O1, server mode, port 7700, DHCP on.
 */
void config_defaults(device_config_t *cfg);

#endif /* CONFIG_H */
