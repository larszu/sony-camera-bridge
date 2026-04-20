/**
 * Sony 700PTP Frame-Aware RS-422 ↔ TCP Bridge
 * Custom Firmware for WIZnet WIZ108SR (W7500P ARM Cortex-M0)
 *
 * Purpose:
 *   Transparent, frame-aware bridge between Sony 8-pin RS-422 and Ethernet.
 *   Detects Sony 700PTP frame boundaries on the serial side and forwards
 *   complete frames as single TCP packets with zero buffering delay.
 *
 * Hardware: WIZ108SR module
 *   - W7500P (Cortex-M0 + hardwired TCP/IP + PHY)
 *   - SP3082E RS-422 transceiver on UART1
 *   - RJ45 Ethernet
 *   - 12-pin screw terminal
 *
 * Build: arm-none-eabi-gcc with WIZnet W7500x_Library
 * Flash: W7500 ISP bootloader via UART0 or SWD
 */

#include "W7500x.h"
#include "W7500x_gpio.h"
#include "W7500x_uart.h"
#include "W7500x_wztoe.h"
#include "socket.h"
#include "dhcp.h"

#include "sony_frame.h"
#include "network.h"
#include "config.h"

/* ── Pin Assignments (WIZ108SR schematic) ───────────────────────────── */
#define LED_TCP_PORT        GPIOC
#define LED_TCP_PIN         GPIO_Pin_8
#define LED_SERIAL_PORT     GPIOC
#define LED_SERIAL_PIN      GPIO_Pin_9

/* ── Global State ───────────────────────────────────────────────────── */
static sony_frame_ctx_t  uart_frame_ctx;   /* UART→TCP frame assembler   */
static sony_frame_ctx_t  tcp_frame_ctx;    /* TCP→UART frame assembler   */

static volatile uint8_t  uart_rx_buf[2048];
static volatile uint16_t uart_rx_head = 0;
static volatile uint16_t uart_rx_tail = 0;

static uint8_t           tcp_rx_buf[2048];
static uint8_t           frame_buf[512];

static device_config_t   cfg;

/* ── Forward Declarations ───────────────────────────────────────────── */
static void SystemClock_Config(void);
static void GPIO_Config(void);
static void UART1_Config(uint32_t baudrate, uint8_t parity);
static void UART1_IRQHandler_impl(void);
static void led_tcp(uint8_t on);
static void led_serial(uint8_t on);
static uint32_t millis(void);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN                                                                */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
int main(void)
{
    SystemClock_Config();
    GPIO_Config();
    led_tcp(0);
    led_serial(0);

    /* Load config from flash (IP, peer, baudrate, mode) */
    config_load(&cfg);

    /* Init serial: 38400 8O1 for Sony RS-422 */
    UART1_Config(cfg.baudrate, cfg.parity);

    /* Init network */
    network_init(&cfg);

    /* Init frame parsers */
    sony_frame_init(&uart_frame_ctx);
    sony_frame_init(&tcp_frame_ctx);

    uint8_t  sock_status;
    int32_t  recv_len;
    uint16_t frame_len;
    uint32_t last_uart_byte_time = 0;
    uint32_t last_tcp_activity   = 0;
    uint8_t  tcp_connected       = 0;

    /* ── Main Loop ──────────────────────────────────────────────── */
    while (1)
    {
        /* ── 1. Handle TCP socket state machine ────────────────── */
        sock_status = getSn_SR(SOCK_BRIDGE);

        switch (sock_status)
        {
        case SOCK_CLOSED:
            /* Open socket */
            if (cfg.mode == MODE_SERVER) {
                socket(SOCK_BRIDGE, Sn_MR_TCP, cfg.local_port, 0x00);
            } else {
                socket(SOCK_BRIDGE, Sn_MR_TCP, cfg.local_port, 0x00);
            }
            tcp_connected = 0;
            led_tcp(0);
            break;

        case SOCK_INIT:
            if (cfg.mode == MODE_SERVER) {
                listen(SOCK_BRIDGE);
            } else {
                connect(SOCK_BRIDGE, cfg.peer_ip, cfg.peer_port);
            }
            break;

        case SOCK_LISTEN:
            /* Waiting for incoming connection */
            break;

        case SOCK_ESTABLISHED:
            if (!tcp_connected) {
                tcp_connected = 1;
                led_tcp(1);
                sony_frame_init(&tcp_frame_ctx);
            }

            /* ── TCP → UART: receive and forward ───────────── */
            recv_len = getSn_RX_RSR(SOCK_BRIDGE);
            if (recv_len > 0) {
                if (recv_len > (int32_t)sizeof(tcp_rx_buf))
                    recv_len = sizeof(tcp_rx_buf);

                recv_len = recv(SOCK_BRIDGE, tcp_rx_buf, recv_len);
                last_tcp_activity = millis();

                /*
                 * Feed bytes through frame detector.
                 * Each complete frame is forwarded to UART immediately.
                 * This ensures frame boundaries are preserved.
                 */
                for (int32_t i = 0; i < recv_len; i++) {
                    frame_len = sony_frame_feed(&tcp_frame_ctx,
                                                tcp_rx_buf[i],
                                                frame_buf,
                                                sizeof(frame_buf));
                    if (frame_len > 0) {
                        /* Send complete frame to UART */
                        for (uint16_t j = 0; j < frame_len; j++) {
                            while (UART_GetFlagStatus(UART1, UART_FLAG_TXFF))
                                ;
                            UART_SendData(UART1, frame_buf[j]);
                        }
                        led_serial(1);
                    }
                }
            }
            break;

        case SOCK_CLOSE_WAIT:
            disconnect(SOCK_BRIDGE);
            tcp_connected = 0;
            led_tcp(0);
            break;

        default:
            break;
        }

        /* ── 2. UART → TCP: drain ring buffer, detect frames ── */
        while (uart_rx_head != uart_rx_tail)
        {
            uint8_t byte = uart_rx_buf[uart_rx_tail];
            uart_rx_tail = (uart_rx_tail + 1) % sizeof(uart_rx_buf);
            last_uart_byte_time = millis();

            frame_len = sony_frame_feed(&uart_frame_ctx,
                                        byte,
                                        frame_buf,
                                        sizeof(frame_buf));
            if (frame_len > 0 && tcp_connected) {
                /*
                 * CRITICAL: send() on W7500 hardware TCP/IP pushes
                 * data immediately — no Nagle algorithm.
                 * Complete frame = single TCP segment.
                 */
                send(SOCK_BRIDGE, frame_buf, frame_len);
                last_tcp_activity = millis();
                led_serial(1);
            }
        }

        /*
         * Frame timeout: if partial frame data sits for > 5ms
         * with no new bytes, flush it anyway. Handles desyncs.
         */
        if (uart_frame_ctx.state != FRAME_IDLE &&
            (millis() - last_uart_byte_time) > FRAME_TIMEOUT_MS)
        {
            frame_len = sony_frame_flush(&uart_frame_ctx,
                                         frame_buf,
                                         sizeof(frame_buf));
            if (frame_len > 0 && tcp_connected) {
                send(SOCK_BRIDGE, frame_buf, frame_len);
            }
        }

        /* Same timeout for TCP→UART direction */
        if (tcp_frame_ctx.state != FRAME_IDLE &&
            (millis() - last_tcp_activity) > FRAME_TIMEOUT_MS)
        {
            frame_len = sony_frame_flush(&tcp_frame_ctx,
                                         frame_buf,
                                         sizeof(frame_buf));
            if (frame_len > 0) {
                for (uint16_t j = 0; j < frame_len; j++) {
                    while (UART_GetFlagStatus(UART1, UART_FLAG_TXFF))
                        ;
                    UART_SendData(UART1, frame_buf[j]);
                }
            }
        }

        /* ── 3. Handle DHCP if enabled ─────────────────────── */
        if (cfg.dhcp_enable) {
            DHCP_run();
        }

        /* ── 4. Handle configuration protocol (UDP port 5000) ─ */
        network_config_poll(&cfg);

        /* ── 5. LED blink off after short pulse ─────────────── */
        /* (LEDs are turned on in data paths, auto-off here) */
    }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  UART1 Interrupt Handler — fills ring buffer                         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
void UART1_Handler(void)
{
    UART1_IRQHandler_impl();
}

static void UART1_IRQHandler_impl(void)
{
    if (UART_GetITStatus(UART1, UART_IT_FLAG_RXI)) {
        UART_ClearITPendingBit(UART1, UART_IT_FLAG_RXI);

        while (!UART_GetFlagStatus(UART1, UART_FLAG_RXFE)) {
            uint16_t next = (uart_rx_head + 1) % sizeof(uart_rx_buf);
            if (next != uart_rx_tail) {
                uart_rx_buf[uart_rx_head] = (uint8_t)UART_ReceiveData(UART1);
                uart_rx_head = next;
            } else {
                /* Buffer full — discard byte */
                (void)UART_ReceiveData(UART1);
            }
        }
    }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Peripheral Init                                                     */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
static void SystemClock_Config(void)
{
    /* W7500P runs at 20 MHz internal osc, PLL to 48 MHz */
    SystemInit();
}

static void GPIO_Config(void)
{
    GPIO_InitTypeDef GPIO_InitStruct;

    /* TCP Status LED — PC08 */
    GPIO_InitStruct.GPIO_Pin   = LED_TCP_PIN;
    GPIO_InitStruct.GPIO_Mode  = GPIO_Mode_OUT;
    GPIO_Init(LED_TCP_PORT, &GPIO_InitStruct);

    /* Serial Status LED — PC09 */
    GPIO_InitStruct.GPIO_Pin   = LED_SERIAL_PIN;
    GPIO_Init(LED_SERIAL_PORT, &GPIO_InitStruct);
}

static void UART1_Config(uint32_t baudrate, uint8_t parity)
{
    UART_InitTypeDef UART_InitStruct;

    /* UART1 pins: PA[1]=TX, PA[0]=RX (WIZ108SR to SP3082E) */
    *(volatile uint32_t *)(0x41002004) = 0x01;  /* PA1 AF1 = UART1_TX */
    *(volatile uint32_t *)(0x41002000) = 0x01;  /* PA0 AF1 = UART1_RX */

    UART_StructInit(&UART_InitStruct);
    UART_InitStruct.UART_BaudRate            = baudrate;
    UART_InitStruct.UART_WordLength          = UART_WordLength_8b;
    UART_InitStruct.UART_StopBits            = UART_StopBits_1;
    UART_InitStruct.UART_HardwareFlowControl = UART_HardwareFlowControl_None;
    UART_InitStruct.UART_Mode                = UART_Mode_Rx | UART_Mode_Tx;

    if (parity == PARITY_ODD)
        UART_InitStruct.UART_Parity = UART_Parity_Odd;
    else if (parity == PARITY_EVEN)
        UART_InitStruct.UART_Parity = UART_Parity_Even;
    else
        UART_InitStruct.UART_Parity = UART_Parity_No;

    UART_Init(UART1, &UART_InitStruct);

    /* Enable RX interrupt */
    UART_ITConfig(UART1, UART_IT_FLAG_RXI, ENABLE);
    NVIC_EnableIRQ(UART1_IRQn);
}

static void led_tcp(uint8_t on)
{
    if (on) GPIO_SetBits(LED_TCP_PORT, LED_TCP_PIN);
    else    GPIO_ResetBits(LED_TCP_PORT, LED_TCP_PIN);
}

static void led_serial(uint8_t on)
{
    if (on) GPIO_SetBits(LED_SERIAL_PORT, LED_SERIAL_PIN);
    else    GPIO_ResetBits(LED_SERIAL_PORT, LED_SERIAL_PIN);
}

static volatile uint32_t tick_ms = 0;

void SysTick_Handler(void)
{
    tick_ms++;
}

static uint32_t millis(void)
{
    return tick_ms;
}
