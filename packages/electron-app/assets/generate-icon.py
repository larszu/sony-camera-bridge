# Generate a minimal placeholder icon.ico for electron-builder
# Run once: node generate-icon.mjs
import sys, struct, zlib

def make_ico():
    """Create a minimal 32x32 red PNG icon as .ico"""
    # Simple 32x32 red icon as raw ICO
    w, h = 32, 32
    
    # Create a simple PNG in memory
    def png_chunk(name, data):
        crc = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    
    raw = b''
    for y in range(h):
        raw += b'\x00'  # filter type
        for x in range(w):
            # Red icon with rounded feel
            cx, cy = x - w/2, y - h/2
            dist = (cx*cx + cy*cy) ** 0.5
            if dist < 14:
                raw += bytes([0xC0, 0x39, 0x2B])  # Red
            else:
                raw += bytes([0x16, 0x16, 0x1E])  # Dark bg
    
    compressed = zlib.compress(raw)
    
    png = (b'\x89PNG\r\n\x1a\n'
           + png_chunk(b'IHDR', ihdr)
           + png_chunk(b'IDAT', compressed)
           + png_chunk(b'IEND', b''))
    
    return png

png_data = make_ico()
with open('assets/icon.png', 'wb') as f:
    f.write(png_data)
print('Generated assets/icon.png')
