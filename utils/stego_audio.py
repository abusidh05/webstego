"""
stego_audio.py - LSB steganography for WAV audio files using the wave module.

Protocol:
  - First 32 bits  : length of payload in bytes
  - Remaining bits : payload bytes, each bit in LSB of sequential audio samples
"""

import wave
import struct
import io


def embed(audio_bytes: bytes, payload: bytes) -> bytes:
    """
    Embed payload into a WAV file using LSB steganography.
    Returns bytes of the stego WAV file.
    """
    in_buf = io.BytesIO(audio_bytes)
    with wave.open(in_buf, "rb") as wav_in:
        params = wav_in.getparams()
        n_frames = wav_in.getnframes()
        n_channels = wav_in.getnchannels()
        sample_width = wav_in.getsampwidth()
        raw_frames = wav_in.readframes(n_frames)

    # Only 16-bit PCM supported for clean LSB
    if sample_width != 2:
        raise ValueError("Only 16-bit PCM WAV files are supported.")

    # Unpack samples as signed shorts
    samples = list(struct.unpack(f"<{len(raw_frames)//2}h", raw_frames))

    # Build bit stream
    length_bits = [int(b) for b in format(len(payload), "032b")]
    payload_bits = []
    for byte in payload:
        payload_bits.extend([int(b) for b in format(byte, "08b")])
    all_bits = length_bits + payload_bits

    if len(all_bits) > len(samples):
        raise ValueError(
            f"Audio too short: needs {len(all_bits)} samples, have {len(samples)}."
        )

    # Embed bits into LSB of each sample
    for i, bit in enumerate(all_bits):
        samples[i] = (samples[i] & ~1) | bit

    new_raw = struct.pack(f"<{len(samples)}h", *samples)

    out_buf = io.BytesIO()
    with wave.open(out_buf, "wb") as wav_out:
        wav_out.setparams(params)
        wav_out.writeframes(new_raw)

    return out_buf.getvalue()


def extract(audio_bytes: bytes) -> bytes:
    """
    Extract hidden payload from a stego WAV file.
    Returns the raw payload bytes.
    """
    in_buf = io.BytesIO(audio_bytes)
    with wave.open(in_buf, "rb") as wav_in:
        sample_width = wav_in.getsampwidth()
        n_frames = wav_in.getnframes()
        raw_frames = wav_in.readframes(n_frames)

    if sample_width != 2:
        raise ValueError("Only 16-bit PCM WAV files are supported.")

    samples = list(struct.unpack(f"<{len(raw_frames)//2}h", raw_frames))
    all_bits = [s & 1 for s in samples]

    # Read 32-bit length header
    length = int("".join(str(b) for b in all_bits[:32]), 2)

    if length == 0 or length > len(all_bits) // 8:
        raise ValueError("No hidden data found or audio is corrupted.")

    payload_bits = all_bits[32: 32 + length * 8]
    payload = bytearray()
    for i in range(0, len(payload_bits), 8):
        byte = int("".join(str(b) for b in payload_bits[i:i + 8]), 2)
        payload.append(byte)

    return bytes(payload)
