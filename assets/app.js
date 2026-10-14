
const cfg = window.VOXORA_CONFIG || {};

let voices = [];
let audioUrl = "";

const guest = [
  {
    id: "guest-aria",
    name: "Aria",
    gender: "Female",
    accent: "American",
    type: "Guest preview"
  },
  {
    id: "guest-daniel",
    name: "Daniel",
    gender: "Male",
    accent: "British",
    type: "Guest preview"
  }
];

const esc = x =>
  String(x ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));

function note(message) {
  const n = $("#notice");

  if (n) {
    n.textContent = message;
    n.classList.add("show");
  }
}

async function backend(path, options = {}) {
  const baseUrl = (cfg.tts?.baseUrl || "").replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("TTS backend URL is missing in config.js.");
  }

  let response;

  try {
    response = await fetch(baseUrl + path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(
      "Cannot reach the TTS backend. Check the backend URL and browser connection."
    );
  }

  if (!response.ok) {
    let detail = "";

    try {
      const data = await response.json();
      detail = data.detail
        ? (typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail))
        : JSON.stringify(data);
    } catch {
      detail = await response.text().catch(() => "");
    }

    throw new Error(
      `Backend HTTP ${response.status}${detail ? ": " + detail : ""}`
    );
  }

  return response;
}

function normalize(v) {
  return {
    id: v.id || v.voice_id || v.value || v.name,
    name: v.name || v.label || "Voice",
    gender: v.gender || "Voice",
    accent: v.accent || v.language || "English",
    type: "Backend voice"
  };
}

async function loadVoices() {
  try {
    const response = await backend(cfg.tts?.voicesPath || "/voices");
    const data = await response.json();

    voices = Array.isArray(data)
      ? data
      : (data.voices || data.data || []);
  } catch (error) {
    console.error("Could not load backend voices:", error);
    voices = [];
  }

  renderVoices();

  const selectedVoice = localStorage.getItem("voxora-selected-voice");
  const select = $("#voice");

  if (select && selectedVoice) {
    const optionExists = [...select.options].some(
      option => option.value === selectedVoice
    );

    if (optionExists) {
      select.value = selectedVoice;
    }
  }
}

function list() {
  return voices.length ? voices.map(normalize) : guest;
}

function renderVoices(filter = "all") {
  const filtered = list().filter(v =>
    filter === "all" || v.gender.toLowerCase() === filter
  );

  const select = $("#voice");

  if (select) {
    select.innerHTML = filtered.map(v =>
      `<option value="${esc(v.id)}">${esc(v.name)} — ${esc(v.gender)} · ${esc(v.accent)}</option>`
    ).join("");
  }

  const grid = $("#voiceGrid");

  if (grid) {
    grid.innerHTML = filtered.map(v =>
      `<article class="voice-card">
        <div class="voice-name">${esc(v.name)}</div>
        <div class="voice-meta">${esc(v.gender)} · ${esc(v.accent)}</div>
        <span class="pill">${esc(v.type)}</span>
        <div class="voice-actions">
          <button class="btn small secondary" data-p="${esc(v.id)}">Preview</button>
          <button class="btn small ghost" data-u="${esc(v.id)}">Use voice</button>
        </div>
      </article>`
    ).join("");
  }
}

function preview(id, text) {
  if (!("speechSynthesis" in window)) {
    note("Browser voice preview is not supported.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(
    text || "This is a Voxora voice preview."
  );

  const browserVoices = speechSynthesis.getVoices();

  if (id.toLowerCase().includes("daniel")) {
    utterance.voice = browserVoices.find(v =>
      /Daniel|George|British|UK/i.test(v.name)
    ) || null;
  }

  if (id.toLowerCase().includes("aria")) {
    utterance.voice = browserVoices.find(v =>
      /Samantha|Aria|Zira|Google US/i.test(v.name)
    ) || null;
  }

  utterance.rate = Number($("#speed")?.value || 1);

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);

  note("Playing browser voice preview. Generated audio uses Piper.");
}

async function generate() {
  const text = $("#text")?.value.trim();

  if (!text) {
    note("Write or paste your script first.");
    return;
  }

  if (!(await getSession())) {
    sessionStorage.setItem("voxora-draft", text);
    sessionStorage.setItem("voxora-return", "studio.html");
    location.href = "login.html";
    return;
  }

  const generateButton = $("#generate");

  if (generateButton) {
    generateButton.disabled = true;
  }

  note("Generating audio with Piper...");

  try {
    // The current Piper backend expects only { text }.
    const response = await backend(
      cfg.tts?.generatePath || "/generate",
      {
        method: "POST",
        body: JSON.stringify({ text })
      }
    );

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("audio/")) {
      const responseText = await response.text();
      throw new Error(
        "Backend did not return an audio file: " +
        responseText.slice(0, 300)
      );
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error("The backend returned an empty audio file.");
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    audioUrl = URL.createObjectURL(blob);

    const audio = $("#audio");

    if (audio) {
      audio.src = audioUrl;
      audio.load();

      try {
        await audio.play();
      } catch {
        // Playback may require a separate click in the browser.
      }
    }

    const downloadButton = $("#download");

    if (downloadButton) {
      downloadButton.disabled = false;
    }

    note("Generation complete. Your WAV audio is ready.");

    try {
      const history = JSON.parse(
        localStorage.getItem("voxora-history") || "[]"
      );

      history.unshift({
        text,
        voice: "en_US-lessac-medium",
        createdAt: new Date().toISOString()
      });

      localStorage.setItem(
        "voxora-history",
        JSON.stringify(history.slice(0, 50))
      );
    } catch (error) {
      console.warn("Could not save generation history:", error);
    }
  } catch (error) {
    console.error("Voxora generation error:", error);

    note("Generation failed: " + error.message);
  } finally {
    if (generateButton) {
      generateButton.disabled = false;
    }
  }
}

async function chat(message) {
  const endpoint =
    localStorage.getItem("voxora-chat-endpoint") ||
    cfg.assistant?.endpoint;

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: "Voxora AI TTS Studio"
        })
      });

      const data = await response.json();

      return data.reply || data.message || data.text;
    } catch {
      // Use local guidance below if the assistant endpoint is unavailable.
    }
  }

  const query = message.toLowerCase();

  if (/login|sign/.test(query)) {
    return "Use Log in to authenticate. After login, Voxora returns you to the Studio.";
  }

  if (/generate|tts|voiceover/.test(query)) {
    return "Choose a voice, enter your script and press Generate voice. Audio is generated using the configured TTS backend.";
  }

  if (/preview/.test(query)) {
    return "Preview uses a browser voice. Generated audio uses the connected TTS backend.";
  }

  if (/voice|accent/.test(query)) {
    return "Available voices are loaded from the backend /voices endpoint.";
  }

  if (/setting|backend/.test(query)) {
    return "Check Settings and ensure the configured backend URL and endpoint paths are correct.";
  }

  return "I can guide you through login, voices, preview, audio generation, WAV export and backend setup.";
}

function initStudio() {
  const authPromise = requireAuth();
  const textInput = $("#text");

  const draft = sessionStorage.getItem("voxora-draft");

  if (draft && textInput) {
    textInput.value = draft;
    sessionStorage.removeItem("voxora-draft");
  }

  const updateCount = () => {
    const count = $("#count");

    if (count && textInput) {
      count.textContent =
        textInput.value.length.toLocaleString() + " characters";
    }
  };

  if (textInput) {
    textInput.oninput = updateCount;
    updateCount();
  }

  $("#clear")?.addEventListener("click", () => {
    if (textInput) {
      textInput.value = "";
      updateCount();
    }
  });

  $("#generate")?.addEventListener("click", generate);

  $("#preview")?.addEventListener("click", () =>
    preview($("#voice")?.value || "", textInput?.value || "")
  );

  $("#download")?.addEventListener("click", () => {
    if (!audioUrl) {
      note("Generate audio before downloading.");
      return;
    }

    const link = document.createElement("a");

    link.href = audioUrl;
    link.download = "voxora-voiceover.wav";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  [["speed", "speedOut"], ["pitch", "pitchOut"], ["volume", "volumeOut"]]
    .forEach(([id, outputId]) => {
      $("#" + id)?.addEventListener("input", () => {
        const output = $("#" + outputId);
        const input = $("#" + id);

        if (!output || !input) return;

        output.textContent = id === "volume"
          ? Math.round(input.value * 100) + "%"
          : Number(input.value).toFixed(2) + "×";
      });
    });

  loadVoices();

  authPromise.then(session => {
    const status = $("#status");

    if (status) {
      status.textContent = session ? "Signed in" : "Guest";
    }
  }).catch(console.error);
}

function initVoices() {
  initTheme();
  loadVoices();

  $$(".filter-chip").forEach(button => {
    button.onclick = () => {
      $$(".filter-chip").forEach(item =>
        item.classList.remove("active")
      );

      button.classList.add("active");
      renderVoices(button.dataset.filter);
    };
  });

  document.addEventListener("click", event => {
    const previewId = event.target.dataset.p;
    const useId = event.target.dataset.u;

    if (previewId) {
      preview(previewId);
    }

    if (useId) {
      localStorage.setItem("voxora-selected-voice", useId);
      location.href = "studio.html";
    }
  });
}

function initHistory() {
  const historyList = $("#historyList");

  if (!historyList) return;

  const history = JSON.parse(
    localStorage.getItem("voxora-history") || "[]"
  );

  historyList.innerHTML = history.length
    ? history.map((item, index) =>
        `<div class="history-row">
          <div>
            <b>${esc(item.text.slice(0, 70))}</b>
            <small>${new Date(item.createdAt).toLocaleString()}</small>
          </div>
          <span class="pill">${esc(item.voice)}</span>
          <button class="icon-btn" data-d="${index}">×</button>
        </div>`
      ).join("")
    : '<div class="card"><b>No generations yet.</b><p>Completed generations will appear here.</p></div>';

  historyList.onclick = event => {
    const index = event.target.dataset.d;

    if (index === undefined) return;

    history.splice(Number(index), 1);

    localStorage.setItem(
      "voxora-history",
      JSON.stringify(history)
    );

    initHistory();
  };
}

function initSettings() {
  $("#backendUrl").value = cfg.tts?.baseUrl || "";
  $("#generatePath").value = cfg.tts?.generatePath || "/generate";
  $("#voicesPath").value = cfg.tts?.voicesPath || "/voices";
  $("#healthPath").value = cfg.tts?.healthPath || "/";
  $("#assistantEndpoint").value = cfg.assistant?.endpoint || "";

  $("#saveBackend").onclick = () => {
    localStorage.setItem(
      "voxora-chat-endpoint",
      $("#assistantEndpoint").value
    );

    note("Saved assistant endpoint for this browser. Update config.js to change the TTS backend URL.");
  };

  $("#testBackend").onclick = async () => {
    try {
      const url = $("#backendUrl").value.replace(/\/$/, "");
      const healthPath = $("#healthPath").value;

      const response = await fetch(url + healthPath);

      note(
        "Connected — HTTP " + response.status + " · " +
        (await response.text()).slice(0, 180)
      );
    } catch (error) {
      note("Connection failed: " + error.message);
    }
  };
}

function initChat() {
  const chatBox = $("#chatBox");

  $("#chatToggle")?.addEventListener("click", () => {
    if (chatBox) {
      chatBox.hidden = !chatBox.hidden;
    }
  });

  $("#chatForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const input = $("#chatInput");
    const message = input.value.trim();

    if (!message) return;

    $("#messages").insertAdjacentHTML(
      "beforeend",
      `<div class="msg user">${esc(message)}</div>`
    );

    input.value = "";

    $("#messages").insertAdjacentHTML(
      "beforeend",
      `<div class="msg">${esc(await chat(message))}</div>`
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initChat();

  if (document.body.dataset.page === "studio") {
    initStudio();
  }

  if (document.body.dataset.page === "voices") {
    initVoices();
  }

  if (document.body.dataset.page === "history") {
    initHistory();
  }

  if (document.body.dataset.page === "settings") {
    initSettings();
  }
});
