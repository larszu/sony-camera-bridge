# ────────────────────────────────────────────────────────────────────
#  Sony 700PTP Bridge Firmware for WIZnet WIZ108SR (W7500P)
#
#  Prerequisites:
#    1. ARM GCC toolchain (arm-none-eabi-gcc)
#       Download: https://developer.arm.com/downloads/-/gnu-rm
#    2. WIZnet W7500x Library
#       git clone https://github.com/Wiznet/W7500x_Library.git lib/W7500x
#    3. WIZnet ioLibrary_Driver (socket API)
#       git clone https://github.com/Wiznet/ioLibrary_Driver.git lib/ioLibrary
#
#  Build: make
#  Flash: make flash PORT=COM3
# ────────────────────────────────────────────────────────────────────

PREFIX  = arm-none-eabi-
CC      = $(PREFIX)gcc
OBJCOPY = $(PREFIX)objcopy
SIZE    = $(PREFIX)size

# ── Paths ──────────────────────────────────────────────────────────
W7500X_LIB = lib/W7500x
IOLIB      = lib/ioLibrary

SRC_DIR    = src
BUILD_DIR  = build

# ── Sources ────────────────────────────────────────────────────────
C_SRCS  = $(wildcard $(SRC_DIR)/*.c)
C_SRCS += $(W7500X_LIB)/Libraries/W7500x_StdPeriph_Driver/src/W7500x_gpio.c
C_SRCS += $(W7500X_LIB)/Libraries/W7500x_StdPeriph_Driver/src/W7500x_uart.c
C_SRCS += $(W7500X_LIB)/Libraries/W7500x_StdPeriph_Driver/src/W7500x_wztoe.c
C_SRCS += $(W7500X_LIB)/Libraries/W7500x_StdPeriph_Driver/src/W7500x_flash.c
C_SRCS += $(W7500X_LIB)/Libraries/CMSIS/Device/WIZnet/W7500/Source/system_W7500x.c
C_SRCS += $(IOLIB)/Ethernet/socket.c
C_SRCS += $(IOLIB)/Internet/DHCP/dhcp.c

STARTUP = $(W7500X_LIB)/Libraries/CMSIS/Device/WIZnet/W7500/Source/GCC/startup_W7500x.S

# ── Include Paths ──────────────────────────────────────────────────
INCLUDES  = -I$(SRC_DIR)
INCLUDES += -I$(W7500X_LIB)/Libraries/CMSIS/Device/WIZnet/W7500/Include
INCLUDES += -I$(W7500X_LIB)/Libraries/CMSIS/Include
INCLUDES += -I$(W7500X_LIB)/Libraries/W7500x_StdPeriph_Driver/inc
INCLUDES += -I$(IOLIB)/Ethernet
INCLUDES += -I$(IOLIB)/Internet/DHCP

# ── Compiler Flags ─────────────────────────────────────────────────
CFLAGS  = -mcpu=cortex-m0 -mthumb -mfloat-abi=soft
CFLAGS += -Os -g -Wall -Wextra
CFLAGS += -ffunction-sections -fdata-sections
CFLAGS += -DUSE_STDPERIPH_DRIVER -DW7500P
CFLAGS += $(INCLUDES)

LDFLAGS  = -mcpu=cortex-m0 -mthumb -mfloat-abi=soft
LDFLAGS += -Wl,--gc-sections
LDFLAGS += -T link/w7500x_flash.ld
LDFLAGS += --specs=nano.specs --specs=nosys.specs

# ── Objects ────────────────────────────────────────────────────────
OBJS  = $(patsubst %.c, $(BUILD_DIR)/%.o, $(notdir $(C_SRCS)))
OBJS += $(BUILD_DIR)/startup.o

TARGET = $(BUILD_DIR)/sony_bridge

# ── Rules ──────────────────────────────────────────────────────────
all: $(TARGET).bin
	$(SIZE) $(TARGET).elf

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

# Library source compilation rules
$(BUILD_DIR)/%.o: $(W7500X_LIB)/Libraries/W7500x_StdPeriph_Driver/src/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/%.o: $(W7500X_LIB)/Libraries/CMSIS/Device/WIZnet/W7500/Source/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/%.o: $(IOLIB)/Ethernet/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/%.o: $(IOLIB)/Internet/DHCP/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/startup.o: $(STARTUP) | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET).elf: $(OBJS)
	$(CC) $(LDFLAGS) $^ -o $@

$(TARGET).bin: $(TARGET).elf
	$(OBJCOPY) -O binary $< $@

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

clean:
	rm -rf $(BUILD_DIR)

# ── Flash via W7500 UART Bootloader ───────────────────────────────
# Requires: pip install w7500-isp
PORT ?= COM3
flash: $(TARGET).bin
	python -m w7500_isp -p $(PORT) -b 115200 write $<

.PHONY: all clean flash
