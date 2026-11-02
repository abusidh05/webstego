/* ============================================================
   script.js — Stego Web Vault frontend logic
   Handles: file drag-drop, form submission, terminal output,
            password toggle, preview rendering, copy-to-clipboard
   ============================================================ */

(function () {
  "use strict";

  /* ── Utility helpers ─────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const hide = (el) => el && el.classList.add("hidden");
  const show = (el) => el && el.classList.remove("hidden");

  /* ── Terminal logger ─────────────────────────────────── */
  function termLog(terminal, message, type = "normal") {
    if (!terminal) return;
    const line = document.createElement("div");
    line.className = `terminal-line ${type}`;
    line.textContent = "> " + message;
    // Insert before cursor
    const cursor = terminal.querySelector(".terminal-cursor");
    if (cursor) {
      terminal.insertBefore(line, cursor);
    } else {
      terminal.appendChild(line);
    }
    terminal.scrollTop = terminal.scrollHeight;
  }

  /* ── File drop-zone wiring ───────────────────────────── */
  function wireDropZone(dropEl, inputEl, nameEl, onLoad) {
    if (!dropEl || !inputEl) return;

    dropEl.addEventListener("click", () => inputEl.click());

    dropEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropEl.classList.add("dragover");
    });
    dropEl.addEventListener("dragleave", () => dropEl.classList.remove("dragover"));
    dropEl.addEventListener("drop", (e) => {
      e.preventDefault();
      dropEl.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) {
        setFileToInput(inputEl, file);
        updateDropName(dropEl, nameEl, file);
        if (onLoad) onLoad(file);
      }
    });

    inputEl.addEventListener("change", () => {
      const file = inputEl.files[0];
      if (file) {
        updateDropName(dropEl, nameEl, file);
        if (onLoad) onLoad(file);
      }
    });
  }

  function updateDropName(dropEl, nameEl, file) {
    if (nameEl) {
      nameEl.textContent = `${file.name}  (${formatBytes(file.size)})`;
    }
    dropEl.classList.add("loaded");
  }

  // Transfer a File object onto a real file input so FormData picks it up
  function setFileToInput(inputEl, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    inputEl.files = dt.files;
  }

  /* ── Format bytes ────────────────────────────────────── */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }

  /* ── Image preview ───────────────────────────────────── */
  function renderPreview(file, previewInner, previewMeta) {
    if (!previewInner) return;
    previewInner.innerHTML = "";
    previewMeta.textContent = "";

    if (!file) {
      previewInner.innerHTML = '<div class="preview-placeholder">No file loaded</div>';
      return;
    }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.alt = "Preview";
        previewInner.appendChild(img);
        previewMeta.textContent =
          `${file.name} | ${file.type.split("/")[1].toUpperCase()} | ${formatBytes(file.size)}`;
      };
      reader.readAsDataURL(file);
    } else {
      // Audio or other
      const placeholder = document.createElement("div");
      placeholder.className = "preview-placeholder";
      placeholder.textContent = `♪ ${file.name}  (${formatBytes(file.size)})`;
      previewInner.appendChild(placeholder);
      previewMeta.textContent = `${file.type || "audio/wav"} | ${formatBytes(file.size)}`;
    }
  }

  /* ── Password visibility toggle ─────────────────────── */
  function wirePwdToggle(toggleBtn, inputEl) {
    if (!toggleBtn || !inputEl) return;
    toggleBtn.addEventListener("click", () => {
      if (inputEl.type === "password") {
        inputEl.type = "text";
        toggleBtn.style.color = "var(--green)";
      } else {
        inputEl.type = "password";
        toggleBtn.style.color = "";
      }
    });
  }

  /* ── Download blob helper ────────────────────────────── */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* ============================================================
     EMBED PAGE
  ============================================================ */
  const embedForm = $("#embedForm");
  if (embedForm) {
    const terminal       = $("#outputTerminal");
    const successCard    = $("#successCard");
    const capacityFill   = $("#capacityFill");
    const capacityPct    = $("#capacityPct");
    const successSub     = $("#successSub");
    const previewInner   = $("#previewInner");
    const previewMeta    = $("#previewMeta");
    const carrierDrop    = $("#carrierDrop");
    const carrierInput   = $("#carrierFile");
    const carrierName    = $("#carrierName");
    const secretDrop     = $("#secretDrop");
    const secretInput    = $("#secretFile");
    const secretName     = $("#secretName");
    const textSection    = $("#textSection");
    const fileSection    = $("#fileSection");
    const secretTextArea = $("#secretText");
    const charCount      = $("#charCount");
    const toggleText     = $("#toggleText");
    const toggleFile     = $("#toggleFile");
    const embedBtn       = $("#embedBtn");
    const embedSpinner   = $("#embedSpinner");
    const embedBtnText   = $("#embedBtnText");
    const embedPwdToggle = $("#embedPwdToggle");
    const embedPassword  = $("#embedPassword");

    // Character counter
    if (secretTextArea) {
      secretTextArea.addEventListener("input", () => {
        if (charCount) charCount.textContent = secretTextArea.value.length;
      });
    }

    // Toggle text/file
    toggleText.addEventListener("click", () => {
      toggleText.classList.add("active");
      toggleFile.classList.remove("active");
      show(textSection);
      hide(fileSection);
    });
    toggleFile.addEventListener("click", () => {
      toggleFile.classList.add("active");
      toggleText.classList.remove("active");
      hide(textSection);
      show(fileSection);
    });

    // Wire drop zones
    wireDropZone(carrierDrop, carrierInput, carrierName, (file) => {
      renderPreview(file, previewInner, previewMeta);
      termLog(terminal, `Carrier loaded: ${file.name} (${formatBytes(file.size)})`, "info");
    });
    wireDropZone(secretDrop, secretInput, secretName, (file) => {
      termLog(terminal, `Secret file loaded: ${file.name} (${formatBytes(file.size)})`, "info");
    });

    // Password toggle
    wirePwdToggle(embedPwdToggle, embedPassword);

    // Form submit
    embedForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hide(successCard);

      // Validate
      if (!carrierInput.files[0]) {
        termLog(terminal, "ERROR: No carrier file selected.", "error"); return;
      }

      const isFileMode = toggleFile.classList.contains("active");
      if (isFileMode && !secretInput.files[0]) {
        termLog(terminal, "ERROR: No secret file selected.", "error"); return;
      }
      if (!isFileMode && !secretTextArea.value.trim()) {
        termLog(terminal, "ERROR: Secret text is empty.", "error"); return;
      }

      // UI loading state
      embedBtn.disabled = true;
      show(embedSpinner);
      embedBtnText.textContent = "PROCESSING...";
      termLog(terminal, "Building payload...", "info");

      const formData = new FormData(embedForm);
      if (!isFileMode) {
        // Remove file entry if in text mode
        formData.delete("secret_file");
      } else {
        formData.delete("secret_text");
      }

      try {
        termLog(terminal, "Uploading to server...", "info");
        const resp = await fetch("/api/embed", { method: "POST", body: formData });

        if (!resp.ok) {
          const err = await resp.json();
          termLog(terminal, `ERROR: ${err.error || "Server error"}`, "error");
          return;
        }

        // Success — get blob for download
        const blob = await resp.blob();
        const disposition = resp.headers.get("Content-Disposition") || "";
        const fnMatch = disposition.match(/filename="?([^";\n]+)"?/);
        const filename = fnMatch ? fnMatch[1] : "stego_output.png";

        termLog(terminal, `Embedding complete.`, "success");
        termLog(terminal, `Output: ${filename} (${formatBytes(blob.size)})`, "success");
        if (embedPassword.value) {
          termLog(terminal, "Payload encrypted with AES-256-GCM.", "success");
        }

        // Estimate density
        const carrierSize = carrierInput.files[0].size;
        const rawPct = Math.min(100, ((blob.size - carrierSize + blob.size * 0.05) / carrierSize * 100)).toFixed(1);
        const displayPct = Math.max(1, Math.min(99, parseFloat(rawPct)));
        capacityFill.style.width = displayPct + "%";
        capacityPct.textContent = displayPct + "%";
        successSub.textContent = `Download: ${filename}`;

        show(successCard);
        downloadBlob(blob, filename);

      } catch (err) {
        termLog(terminal, `Network error: ${err.message}`, "error");
      } finally {
        embedBtn.disabled = false;
        hide(embedSpinner);
        embedBtnText.textContent = "▶ EMBED & DOWNLOAD";
      }
    });
  }

  /* ============================================================
     EXTRACT PAGE
  ============================================================ */
  const extractForm = $("#extractForm");
  if (extractForm) {
    const terminal        = $("#outputTerminal");
    const resultBox       = $("#resultBox");
    const resultContent   = $("#resultContent");
    const resultMeta      = $("#resultMeta");
    const fileResult      = $("#fileResult");
    const fileResultSub   = $("#fileResultSub");
    const previewInner    = $("#previewInner");
    const previewMeta     = $("#previewMeta");
    const stegoDrop       = $("#stegoDrop");
    const stegoInput      = $("#stegoFile");
    const stegoName       = $("#stegoName");
    const extractBtn      = $("#extractBtn");
    const extractSpinner  = $("#extractSpinner");
    const extractBtnText  = $("#extractBtnText");
    const extractPwdToggle= $("#extractPwdToggle");
    const extractPassword = $("#extractPassword");
    const copyBtn         = $("#copyBtn");

    wireDropZone(stegoDrop, stegoInput, stegoName, (file) => {
      renderPreview(file, previewInner, previewMeta);
      termLog(terminal, `Stego file loaded: ${file.name} (${formatBytes(file.size)})`, "info");
    });

    wirePwdToggle(extractPwdToggle, extractPassword);

    // Copy button
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const text = resultContent ? resultContent.textContent : "";
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "✓ COPIED";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "⊕ COPY";
            copyBtn.classList.remove("copied");
          }, 2000);
        });
      });
    }

    extractForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hide(resultBox);
      hide(fileResult);

      if (!stegoInput.files[0]) {
        termLog(terminal, "ERROR: No stego file selected.", "error"); return;
      }

      extractBtn.disabled = true;
      show(extractSpinner);
      extractBtnText.textContent = "EXTRACTING...";
      termLog(terminal, "Analysing stego file...", "info");

      const formData = new FormData(extractForm);

      try {
        const resp = await fetch("/api/extract", { method: "POST", body: formData });

        // Check if response is JSON (text result or error) or binary (file)
        const contentType = resp.headers.get("Content-Type") || "";

        if (!resp.ok) {
          const err = await resp.json();
          termLog(terminal, `ERROR: ${err.error || "Server error"}`, "error");
          return;
        }

        if (contentType.includes("application/json")) {
          // Text result
          const data = await resp.json();
          if (data.type === "text") {
            termLog(terminal, "Text payload extracted.", "success");
            if (extractPassword.value) {
              termLog(terminal, "Decryption successful.", "success");
            }
            resultContent.textContent = data.content;
            resultMeta.textContent = `${data.content.length} characters`;
            show(resultBox);
          } else if (data.error) {
            termLog(terminal, `ERROR: ${data.error}`, "error");
          }
        } else {
          // File download
          const blob = await resp.blob();
          const disposition = resp.headers.get("Content-Disposition") || "";
          const fnMatch = disposition.match(/filename="?([^";\n]+)"?/);
          const filename = fnMatch ? fnMatch[1] : "extracted_file";

          termLog(terminal, `File payload extracted: ${filename}`, "success");
          termLog(terminal, `Size: ${formatBytes(blob.size)}`, "success");
          if (extractPassword.value) {
            termLog(terminal, "Decryption successful.", "success");
          }

          fileResultSub.textContent = `Downloaded: ${filename} (${formatBytes(blob.size)})`;
          show(fileResult);
          downloadBlob(blob, filename);
        }

      } catch (err) {
        termLog(terminal, `Network error: ${err.message}`, "error");
      } finally {
        extractBtn.disabled = false;
        hide(extractSpinner);
        extractBtnText.textContent = "◀ EXTRACT DATA";
      }
    });
  }

  /* ── Landing page: animated title glitch ─────────────── */
  const accentLine = $(".accent-line");
  if (accentLine) {
    setInterval(() => {
      accentLine.style.textShadow =
        `0 0 ${20 + Math.random() * 30}px rgba(0,255,136,${0.2 + Math.random() * 0.3}),
         0 0 ${60 + Math.random() * 40}px rgba(0,255,136,0.08)`;
    }, 150);
  }

})();
