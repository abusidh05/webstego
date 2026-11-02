"""
app.py - Flask application entry point for Stego Web Vault.

Routes:
  GET  /              - Landing page
  GET  /embed         - Embed page
  GET  /extract       - Extract page
  POST /api/embed     - Perform steganographic embedding
  POST /api/extract   - Perform steganographic extraction
"""

import io
import os
import json
import mimetypes
from flask import (
    Flask, render_template, request, jsonify, send_file, abort
)
from utils.stego_image import embed as img_embed, extract as img_extract
from utils.stego_audio import embed as wav_embed, extract as wav_extract
from utils.encryption import encrypt, decrypt

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB upload limit

# Allowed carrier file types
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg"}
ALLOWED_AUDIO_TYPES = {"audio/wav", "audio/x-wav", "audio/wave"}
ALLOWED_CARRIER_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_AUDIO_TYPES

# Magic byte signatures for validation
MAGIC_BYTES = {
    b"\x89PNG": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"RIFF": "audio/wav",
}


def detect_mime(data: bytes) -> str:
    """Detect file type from magic bytes for security validation."""
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    return "application/octet-stream"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/embed")
def embed_page():
    return render_template("embed.html")


@app.route("/extract")
def extract_page():
    return render_template("extract.html")


@app.route("/api/embed", methods=["POST"])
def api_embed():
    """
    Expects multipart/form-data with:
      - carrier_file : the cover image or WAV file
      - secret_text  : (optional) text to hide
      - secret_file  : (optional) file to hide
      - password     : (optional) encryption password
      - secret_filename : (optional) original filename of secret_file
    """
    if "carrier_file" not in request.files:
        return jsonify({"error": "No carrier file uploaded."}), 400

    carrier_file = request.files["carrier_file"]
    carrier_bytes = carrier_file.read()

    # Validate carrier type via magic bytes
    carrier_mime = detect_mime(carrier_bytes)
    if carrier_mime not in ALLOWED_CARRIER_TYPES:
        return jsonify({"error": "Invalid carrier file type. Use PNG, JPG, or WAV."}), 400

    # Build payload
    password = request.form.get("password", "").strip()
    secret_text = request.form.get("secret_text", "").strip()
    secret_file = request.files.get("secret_file")
    secret_filename = request.form.get("secret_filename", "secret.bin").strip()

    if secret_file and secret_file.filename:
        # File mode: prefix with metadata header so we can restore on extract
        file_bytes = secret_file.read()
        fname = secret_file.filename or secret_filename
        # Header: "FILE:<filename>\x00" + raw file bytes
        header = f"FILE:{fname}\x00".encode("utf-8")
        payload = header + file_bytes
    elif secret_text:
        # Text mode: prefix with "TEXT:" marker
        payload = b"TEXT:" + secret_text.encode("utf-8")
    else:
        return jsonify({"error": "Provide either secret text or a secret file."}), 400

    # Encrypt if password provided
    if password:
        payload = encrypt(payload, password)

    # Embed into carrier
    try:
        if carrier_mime in ALLOWED_IMAGE_TYPES:
            stego_bytes = img_embed(carrier_bytes, payload)
            out_filename = "stego_image.png"
            out_mimetype = "image/png"
        else:
            stego_bytes = wav_embed(carrier_bytes, payload)
            out_filename = "stego_audio.wav"
            out_mimetype = "audio/wav"
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return send_file(
        io.BytesIO(stego_bytes),
        mimetype=out_mimetype,
        as_attachment=True,
        download_name=out_filename,
    )


@app.route("/api/extract", methods=["POST"])
def api_extract():
    """
    Expects multipart/form-data with:
      - stego_file : the stego image or WAV
      - password   : (optional) decryption password
    Returns JSON with extracted data or a file download.
    """
    if "stego_file" not in request.files:
        return jsonify({"error": "No stego file uploaded."}), 400

    stego_file = request.files["stego_file"]
    stego_bytes = stego_file.read()
    password = request.form.get("password", "").strip()

    # Validate type
    stego_mime = detect_mime(stego_bytes)
    if stego_mime not in ALLOWED_CARRIER_TYPES:
        return jsonify({"error": "Invalid file type. Use PNG, JPG, or WAV."}), 400

    # Extract raw payload
    try:
        if stego_mime in ALLOWED_IMAGE_TYPES:
            raw_payload = img_extract(stego_bytes)
        else:
            raw_payload = wav_extract(stego_bytes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Decrypt if password provided
    if password:
        try:
            raw_payload = decrypt(raw_payload, password)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Parse payload type
    if raw_payload.startswith(b"TEXT:"):
        text = raw_payload[5:].decode("utf-8", errors="replace")
        return jsonify({"type": "text", "content": text})

    elif raw_payload.startswith(b"FILE:"):
        # Find the null separator after filename
        null_pos = raw_payload.index(b"\x00", 5)
        filename = raw_payload[5:null_pos].decode("utf-8", errors="replace")
        file_data = raw_payload[null_pos + 1:]

        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        return send_file(
            io.BytesIO(file_data),
            mimetype=mime,
            as_attachment=True,
            download_name=filename,
        )
    else:
        # Unrecognised format - return raw as text best-effort
        try:
            text = raw_payload.decode("utf-8")
            return jsonify({"type": "text", "content": text})
        except Exception:
            return jsonify({"error": "Could not parse extracted data. Wrong password?"}), 400


if __name__ == "__main__":
    app.run(
        debug=os.environ.get("FLASK_DEBUG", "0") == "1",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )
