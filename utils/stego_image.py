"""
stego_image.py - LSB steganography for PNG/JPG images using Pillow.

Protocol:
  - First 32 bits  : length of payload in bytes (big-endian uint32)
  - Remaining bits : payload bytes, each bit in the LSB of sequential pixels (R channel first, then G, then B)
"""

from PIL import Image
import io


DELIMITER_BITS = 32  # 4 bytes to store length


def _int_to_bits(value: int, width: int = 8) -> list:
    return [int(b) for b in format(value, f"0{width}b")]


def _bits_to_int(bits: list) -> int:
    return int("".join(str(b) for b in bits), 2)


def embed(image_bytes: bytes, payload: bytes) -> bytes:
    """
    Embed payload into an image using LSB steganography.
    Returns PNG bytes of the stego image.
    Raises ValueError if the image is too small for the payload.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pixels = list(img.getdata())
    width, height = img.size

    # Build full bit stream: 32-bit length header + payload bits
    length_bits = _int_to_bits(len(payload), 32)
    payload_bits = []
    for byte in payload:
        payload_bits.extend(_int_to_bits(byte, 8))

    all_bits = length_bits + payload_bits
    total_bits = len(all_bits)

    # Each pixel has 3 channels (R, G, B), each can carry 1 bit
    capacity = len(pixels) * 3
    if total_bits > capacity:
        raise ValueError(
            f"Image too small: needs {total_bits} bits, capacity is {capacity} bits."
        )

    bit_index = 0
    new_pixels = []

    for pixel in pixels:
        r, g, b = pixel
        if bit_index < total_bits:
            r = (r & ~1) | all_bits[bit_index]; bit_index += 1
        if bit_index < total_bits:
            g = (g & ~1) | all_bits[bit_index]; bit_index += 1
        if bit_index < total_bits:
            b = (b & ~1) | all_bits[bit_index]; bit_index += 1
        new_pixels.append((r, g, b))

    stego_img = Image.new("RGB", (width, height))
    stego_img.putdata(new_pixels)

    out = io.BytesIO()
    stego_img.save(out, format="PNG")
    return out.getvalue()


def extract(image_bytes: bytes) -> bytes:
    """
    Extract hidden payload from a stego image.
    Returns the raw payload bytes.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    pixels = list(img.getdata())

    all_bits = []
    for pixel in pixels:
        for channel in pixel:
            all_bits.append(channel & 1)

    # Read 32-bit length header
    length = _bits_to_int(all_bits[:DELIMITER_BITS])

    if length == 0 or length > len(all_bits) // 8:
        raise ValueError("No hidden data found or image is corrupted.")

    payload_bits = all_bits[DELIMITER_BITS: DELIMITER_BITS + length * 8]
    payload = bytearray()
    for i in range(0, len(payload_bits), 8):
        byte = _bits_to_int(payload_bits[i:i + 8])
        payload.append(byte)

    return bytes(payload)
