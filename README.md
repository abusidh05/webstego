# Stego Web Vault

A production-ready web application for hiding confidential data inside images
and audio files using LSB (Least Significant Bit) steganography with optional
AES-256-GCM encryption.

---

## Features

- **LSB Steganography** — embed data in PNG, JPG, or WAV files with no perceptible quality loss
- **AES-256-GCM Encryption** — optional password-based encryption before embedding
- **Text & File Embedding** — hide plain text messages or entire binary files
- **Secure Extraction** — extract and decrypt hidden data with the correct password
- **Modern UI** — dark cyberpunk theme, fully responsive

---

## Project Structure

```
StegoWebVault/
├── app.py                  # Flask entry point and API routes
├── requirements.txt        # Python dependencies
├── README.md
├── static/
│   ├── css/style.css       # All styles
│   ├── js/script.js        # Frontend logic
│   └── assets/             # (optional icons / fonts)
├── templates/
│   ├── index.html          # Landing page
│   ├── embed.html          # Embed page
│   └── extract.html        # Extract page
└── utils/
    ├── __init__.py
    ├── stego_image.py      # LSB for PNG/JPG via Pillow
    ├── stego_audio.py      # LSB for WAV via wave module
    └── encryption.py       # AES-256-GCM via cryptography
```

---

## Installation

### 1. Clone / unzip the project

```bash
unzip StegoWebVault.zip
cd StegoWebVault
```

### 2. Create a virtual environment (recommended)

```bash
python3 -m venv venv
source venv/bin/activate      # Linux / macOS
venv\Scripts\activate.bat     # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running the Application

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## Usage

### Embedding a Secret

1. Navigate to **Embed** (`/embed`)
2. Upload a carrier file (PNG, JPG, or WAV)
3. Choose **TEXT** or **FILE** mode and enter your secret
4. Optionally enter a password for encryption
5. Click **EMBED & DOWNLOAD** — the stego file downloads automatically

### Extracting a Secret

1. Navigate to **Extract** (`/extract`)
2. Upload the stego file produced in the embed step
3. Enter the password (if one was used)
4. Click **EXTRACT DATA** — text appears in the panel; files download automatically

---

## Security Notes

- Encryption uses AES-256-GCM (authenticated encryption). Wrong password = authentication failure, no data leakage.
- The key is derived from the password using SHA-256.
- File type validation uses magic bytes, not just file extensions.
- Max upload size: 50 MB.

---

## Dependencies

| Package       | Purpose                                |
|---------------|----------------------------------------|
| Flask         | Web framework                          |
| Pillow        | Image processing (PNG/JPG LSB)         |
| cryptography  | AES-256-GCM encryption/decryption      |

---

## License

MIT — free to use and modify.


## Production deployment (recommended: Render)

This project uses Flask for server-side routes and file processing. Netlify's
standard static-site deployment does not run `app.py` as a persistent Flask
server. Deploy the complete project as a **Web Service** on Render instead.

1. Push the contents of the `Web Stego` folder to a GitHub repository.
2. In Render, choose **New + → Web Service** and connect that repository.
3. Set the root directory to `.` if the repository contains these files at its root.
4. Render detects `render.yaml`; otherwise use:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
5. Deploy, then open the generated `onrender.com` URL.

Do not publish only the `static` or `templates` folders. The deployment root
must contain `app.py`, `requirements.txt`, `Procfile`, `render.yaml`,
`templates/`, `static/`, and `utils/`.

For local testing on Windows:
```bash
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Then open http://127.0.0.1:5000.
