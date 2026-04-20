/**
 * Network Initialization & Configuration Protocol — Implementation
 */

#include "network.h"
#include "W7500x_wztoe.h"
#include "socket.h"
#include "dhcp.h"
#include <string.h>
#include <stdio.h>

/* ── Socket buffer sizes (W7500 has 32KB total) ──────────── */
/*    SOCK_BRIDGE gets 8KB TX + 8KB RX for throughput         */
/*    Others get 1KB each                                      */
static const uint8_t sock_tx_size[8] = { 8, 1, 1, 1, 1, 1, 1, 1 };
static const uint8_t sock_rx_size[8] = { 8, 1, 1, 1, 1, 1, 1, 1 };

/* ── DHCP buffers ────────────────────────────────────────── */
static uint8_t dhcp_buf[548];

/* ── Config protocol ─────────────────────────────────────── */
#define CONFIG_PORT         5000
#define CONFIG_BUF_SIZE     512

static const char DISCOVER_REQ[]  = "SBRG_DISCOVER";
static const char CONFIG_REQ[]    = "SBRG_CONFIG";
static const char CONFIG_ACK[]    = "SBRG_CONFIG_OK";

static uint8_t config_buf[CONFIG_BUF_SIZE];

/* ── DHCP callbacks ──────────────────────────────────────── */
static device_config_t *g_cfg = 0;

static void dhcp_ip_assign(void)    { /* IP assigned by DHCP */ }
static void dhcp_ip_update(void)    { /* IP updated */ }
static void dhcp_ip_conflict(void)  { /* IP conflict */ }

/* ── Public API ──────────────────────────────────────────── */

void network_init(device_config_t *cfg)
{
    g_cfg = cfg;

    /* Set MAC address */
    setSHAR(cfg->mac);

    /* Set socket buffer sizes */
    for (int i = 0; i < 8; i++) {
        setSn_TXBUF_SIZE(i, sock_tx_size[i]);
        setSn_RXBUF_SIZE(i, sock_rx_size[i]);
    }

    if (cfg->dhcp_enable) {
        /* Start with static IP, DHCP will update */
        setSIPR(cfg->local_ip);
        setSUBR(cfg->subnet);
        setGAR(cfg->gateway);

        DHCP_init(SOCK_DHCP, dhcp_buf);
        reg_dhcp_cbfunc(dhcp_ip_assign, dhcp_ip_update, dhcp_ip_conflict);
    } else {
        setSIPR(cfg->local_ip);
        setSUBR(cfg->subnet);
        setGAR(cfg->gateway);
    }

    /* Open UDP socket for configuration protocol */
    socket(SOCK_CONFIG, Sn_MR_UDP, CONFIG_PORT, 0x00);

    /* SysTick for millis() — 1ms tick at 48MHz */
    SysTick_Config(48000);
}

void network_config_poll(device_config_t *cfg)
{
    uint8_t  peer_ip[4];
    uint16_t peer_port;
    int32_t  len;

    if (getSn_SR(SOCK_CONFIG) != SOCK_UDP) {
        socket(SOCK_CONFIG, Sn_MR_UDP, CONFIG_PORT, 0x00);
        return;
    }

    len = getSn_RX_RSR(SOCK_CONFIG);
    if (len <= 0) return;

    len = recvfrom(SOCK_CONFIG, config_buf, sizeof(config_buf) - 1,
                   peer_ip, &peer_port);
    if (len <= 0) return;

    config_buf[len] = '\0';

    /* ── Discovery Request ──────────────────────────────── */
    if (len >= (int32_t)sizeof(DISCOVER_REQ) - 1 &&
        memcmp(config_buf, DISCOVER_REQ, sizeof(DISCOVER_REQ) - 1) == 0)
    {
        /*
         * Respond with JSON device info.
         * Our Bridge software parses this for auto-discovery.
         */
        uint8_t ip[4];
        getSIPR(ip);

        int rlen = snprintf(
            (char *)config_buf, sizeof(config_buf),
            "{"
            "\"ident\":\"%s\","
            "\"fw\":\"%d.%d.%d\","
            "\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\","
            "\"ip\":\"%d.%d.%d.%d\","
            "\"port\":%d,"
            "\"mode\":\"%s\","
            "\"baud\":%lu,"
            "\"parity\":\"%s\""
            "}",
            FW_IDENT,
            FW_VERSION_MAJOR, FW_VERSION_MINOR, FW_VERSION_PATCH,
            cfg->mac[0], cfg->mac[1], cfg->mac[2],
            cfg->mac[3], cfg->mac[4], cfg->mac[5],
            ip[0], ip[1], ip[2], ip[3],
            cfg->local_port,
            cfg->mode == MODE_SERVER ? "server" : "client",
            (unsigned long)cfg->baudrate,
            cfg->parity == PARITY_ODD ? "odd" :
                cfg->parity == PARITY_EVEN ? "even" : "none"
        );

        sendto(SOCK_CONFIG, config_buf, rlen, peer_ip, peer_port);
        return;
    }

    /* ── Configuration Set Request ──────────────────────── */
    if (len >= (int32_t)sizeof(CONFIG_REQ) - 1 &&
        memcmp(config_buf, CONFIG_REQ, sizeof(CONFIG_REQ) - 1) == 0)
    {
        /*
         * Parse JSON config after the "SBRG_CONFIG\0" prefix.
         * Minimal parser: looks for key:"value" pairs.
         *
         * Supported keys:
         *   ip, subnet, gateway, port, mode, peer_ip,
         *   peer_port, baud, parity, dhcp
         */
        const char *json = (const char *)config_buf + sizeof(CONFIG_REQ);

        /* Helper: find integer value for key */
        #define FIND_INT(key, out) do { \
            const char *p = strstr(json, "\"" key "\":"); \
            if (p) { p += strlen("\"" key "\":"); out = atoi_simple(p); } \
        } while(0)

        /* Helper: find IP for key */
        #define FIND_IP(key, out) do { \
            const char *p = strstr(json, "\"" key "\":\""); \
            if (p) { p += strlen("\"" key "\":\""); parse_ip(p, out); } \
        } while(0)

        FIND_IP("ip", cfg->local_ip);
        FIND_IP("subnet", cfg->subnet);
        FIND_IP("gateway", cfg->gateway);
        FIND_IP("peer_ip", cfg->peer_ip);

        int tmp;
        FIND_INT("port", tmp);     if (tmp > 0) cfg->local_port = tmp;
        FIND_INT("peer_port", tmp); if (tmp > 0) cfg->peer_port = tmp;
        FIND_INT("baud", tmp);     if (tmp > 0) cfg->baudrate = tmp;
        FIND_INT("dhcp", tmp);     cfg->dhcp_enable = (tmp != 0);

        /* Mode */
        const char *mp = strstr(json, "\"mode\":\"");
        if (mp) {
            mp += 8;
            cfg->mode = (mp[0] == 'c') ? MODE_CLIENT : MODE_SERVER;
        }

        /* Parity */
        const char *pp = strstr(json, "\"parity\":\"");
        if (pp) {
            pp += 10;
            if (pp[0] == 'o') cfg->parity = PARITY_ODD;
            else if (pp[0] == 'e') cfg->parity = PARITY_EVEN;
            else cfg->parity = PARITY_NONE;
        }

        config_save(cfg);

        /* ACK */
        sendto(SOCK_CONFIG, (uint8_t *)CONFIG_ACK,
               sizeof(CONFIG_ACK) - 1, peer_ip, peer_port);

        /* Device will apply new settings on next reboot.
         * Force soft reset after 100ms to apply immediately. */
        /* NVIC_SystemReset(); — uncomment for auto-reboot */
        return;
    }
}

/* ── Minimal helpers (no stdlib dependency) ──────────────── */

static int atoi_simple(const char *s)
{
    int val = 0;
    while (*s >= '0' && *s <= '9') {
        val = val * 10 + (*s - '0');
        s++;
    }
    return val;
}

static void parse_ip(const char *s, uint8_t *ip)
{
    for (int i = 0; i < 4; i++) {
        ip[i] = (uint8_t)atoi_simple(s);
        while (*s && *s != '.' && *s != '"') s++;
        if (*s == '.') s++;
    }
}
