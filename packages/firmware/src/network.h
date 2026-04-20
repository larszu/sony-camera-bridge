/**
 * Network Initialization & Configuration Protocol
 *
 * Handles:
 * - W7500P Ethernet/TCP-IP core init
 * - DHCP client
 * - UDP configuration protocol (port 5000) compatible with
 *   WIZnet ConfigTool and our Bridge discovery
 */

#ifndef NETWORK_H
#define NETWORK_H

#include "config.h"

/**
 * Initialize W7500P network stack (MAC, IP, socket buffers).
 */
void network_init(device_config_t *cfg);

/**
 * Poll for incoming UDP configuration packets.
 * Responds to discovery broadcasts and config set commands.
 *
 * Protocol (UDP port 5000):
 *   Discovery request:  "SBRG_DISCOVER\0"
 *   Discovery response: JSON with device info
 *   Config set:         "SBRG_CONFIG\0" + JSON
 *   Config ack:         "SBRG_CONFIG_OK\0"
 */
void network_config_poll(device_config_t *cfg);

#endif /* NETWORK_H */
