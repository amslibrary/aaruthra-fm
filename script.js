(function () {
  const config = window.RADIO_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const audio = $("[data-audio]");
  const playButton = $("[data-play]");
  const muteButton = $("[data-mute]");
  const volume = $("[data-volume]");
  const volumeOutput = $("[data-volume-output]");
  const providerPlayer = $("[data-provider-player]");
  const providerLink = $("[data-provider-link]");
  const statusText = $("[data-status-text]");
  const statusPill = $("[data-status-pill]");
  const liveLabel = $("[data-live-label]");
  const connectionFill = $("[data-connection-fill]");
  const localTime = $("[data-local-time]");
  const canvas = $("#waveCanvas");
  const ctx = canvas.getContext("2d");

  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let visualFrame = 0;
  let isTryingToPlay = false;
  let streamUrl = "";

  function setText(selector, value) {
    const node = $(selector);
    if (node && value) node.textContent = value;
  }

  function applyConfig() {
    const name = config.stationName || "NeonWave Radio";
    const shortName = config.shortName || name;
    const now = config.nowPlaying || {};

    document.title = name;
    setText("[data-station-name]", shortName);
    setText("[data-station-title]", name);
    setText("[data-station-tagline]", config.tagline);
    setText("[data-now-show]", now.show);
    setText("[data-now-description]", now.description);
    setText("[data-track-title]", now.title);
    setText("[data-track-meta]", now.meta);
    setText("[data-stream-quality]", config.streamQuality);
    setText("[data-listeners]", config.listeners);
    setText("[data-footer-name]", name);

    const playerUrl = String(config.playerUrl || "").trim();
    if (providerPlayer && playerUrl) providerPlayer.src = playerUrl;
    if (providerLink && playerUrl) providerLink.href = playerUrl;

    streamUrl = String(config.streamUrl || "").trim();
    if (audio && streamUrl) audio.src = streamUrl;
    else if (audio) audio.removeAttribute("src");
    if (audio && volume) audio.volume = Number(volume.value);

    if (providerPlayer) setStatus("Live", "live", 100);
    else if (streamUrl) setStatus("Ready", "waiting", 44);

    renderShows(config.shows || []);
    renderSchedule(config.schedule || []);
    applySocials(config.socials || {});
    setupMediaSession(name, now);
  }

  function renderShows(shows) {
    const grid = $("[data-show-grid]");
    grid.innerHTML = "";
    shows.forEach((show) => {
      const article = document.createElement("article");
      article.className = "show-card";
      article.innerHTML = `
        <span>${escapeHtml(show.time || "Live")}</span>
        <strong>${escapeHtml(show.name || "Show")}</strong>
        <p>${escapeHtml(show.host || "Resident host")} · ${escapeHtml(show.mood || "Open format")}</p>
      `;
      grid.appendChild(article);
    });
  }

  function renderSchedule(items) {
    const list = $("[data-schedule-list]");
    list.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "schedule-row";
      row.innerHTML = `
        <span>${escapeHtml(item.day || "Day")}</span>
        <strong>${escapeHtml(item.show || "Live Broadcast")}</strong>
        <time>${escapeHtml(item.slot || "00:00")}</time>
      `;
      list.appendChild(row);
    });
  }

  function applySocials(socials) {
    Object.entries(socials).forEach(([key, url]) => {
      const link = $(`[data-social="${key}"]`);
      if (link && url) link.href = url;
    });
  }

  function setupMediaSession(name, now) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: now.title || "Live Broadcast",
      artist: name,
      album: now.show || "Live Radio"
    });
    if (!audio) return;
    navigator.mediaSession.setActionHandler("play", startStream);
    navigator.mediaSession.setActionHandler("pause", pauseStream);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function startStream() {
    clearReconnect();
    isTryingToPlay = true;

    if (!streamUrl) {
      setStatus("Add stream URL", "waiting", 18);
      isTryingToPlay = false;
      return;
    }

    try {
      setStatus("Connecting", "connecting", 42);
      if (!audio) return;
      await audio.play();
      reconnectAttempt = 0;
      setStatus("Live", "live", 100);
      updatePlayIcon(true);
    } catch (error) {
      setStatus("Retrying", "warning", 32);
      scheduleReconnect();
    }
  }

  function pauseStream() {
    isTryingToPlay = false;
    clearReconnect();
    if (audio) audio.pause();
    setStatus("Paused", "waiting", 20);
    updatePlayIcon(false);
  }

  function scheduleReconnect() {
    clearReconnect();
    if (!isTryingToPlay) return;
    const delay = Math.min(30000, 1200 * Math.pow(1.65, reconnectAttempt));
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(startStream, delay);
  }

  function clearReconnect() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function setStatus(label, state, width) {
    if (statusText) statusText.textContent = label;
    if (liveLabel) liveLabel.textContent = state === "live" ? "Live signal online" : "Live signal standing by";
    if (connectionFill) connectionFill.style.width = `${width}%`;
    if (statusPill) statusPill.dataset.state = state;
    const uptime = $("[data-uptime]");
    if (uptime) uptime.textContent = state === "live" ? "online" : "standby";
  }

  function updatePlayIcon(isPlaying) {
    if (!playButton) return;
    const icon = isPlaying ? "pause" : "play";
    playButton.setAttribute("aria-label", isPlaying ? "Pause live stream" : "Play live stream");
    playButton.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
    refreshIcons();
  }

  function updateMuteIcon() {
    if (!audio || !muteButton) return;
    const icon = audio.muted || audio.volume === 0 ? "volume-x" : "volume-2";
    muteButton.setAttribute("aria-label", audio.muted ? "Unmute audio" : "Mute audio");
    muteButton.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function tickClock() {
    if (!localTime) return;
    localTime.textContent = new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawWave() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mid = height * 0.48;
    const time = visualFrame * 0.012;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(6, 16, 22, 0.24)";
    ctx.fillRect(0, 0, width, height);

    drawGrid(width, height, time);
    drawSignal(width, mid, time, "#36e5ff", 0);
    drawSignal(width, mid + 34, time * 1.2, "#ff5ea8", 1.8);
    drawSignal(width, mid - 46, time * 0.82, "#8aff8a", 3.2);

    visualFrame += 1;
    requestAnimationFrame(drawWave);
  }

  function drawGrid(width, height, time) {
    ctx.strokeStyle = "rgba(172, 235, 255, 0.08)";
    ctx.lineWidth = 1;
    const spacing = 58;
    const offset = (time * 22) % spacing;
    for (let x = -spacing; x < width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x - 160 + offset, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawSignal(width, y, time, color, phase) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const amp = 34 + Math.sin(time + phase) * 16;
      const wave = Math.sin(x * 0.016 + time * 3 + phase) * amp;
      const pulse = Math.cos(x * 0.007 - time * 2) * 18;
      const py = y + wave + pulse;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (playButton && audio) {
    playButton.addEventListener("click", () => {
      if (audio.paused) startStream();
      else pauseStream();
    });
  }

  if (muteButton && audio) {
    muteButton.addEventListener("click", () => {
      audio.muted = !audio.muted;
      updateMuteIcon();
    });
  }

  if (volume && audio) {
    volume.addEventListener("input", () => {
      audio.volume = Number(volume.value);
      audio.muted = audio.volume === 0;
      if (volumeOutput) volumeOutput.textContent = `${Math.round(audio.volume * 100)}%`;
      updateMuteIcon();
    });
  }

  if (audio) {
    audio.addEventListener("playing", () => {
      setStatus("Live", "live", 100);
      updatePlayIcon(true);
    });

    audio.addEventListener("waiting", () => {
      if (isTryingToPlay) setStatus("Buffering", "connecting", 58);
    });

    audio.addEventListener("error", () => {
      if (isTryingToPlay) {
        setStatus("Reconnecting", "warning", 28);
        scheduleReconnect();
      }
    });
  }

  window.addEventListener("online", () => {
    if (isTryingToPlay) startStream();
  });

  window.addEventListener("offline", () => {
    setStatus("Offline", "warning", 8);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isTryingToPlay && audio && audio.paused) startStream();
  });

  $("[data-share]").addEventListener("click", async () => {
    const payload = {
      title: config.stationName || document.title,
      text: config.tagline || "Listen live.",
      url: window.location.href
    };
    if (navigator.share) {
      await navigator.share(payload);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Link copied", "live", 100);
    }
  });

  window.addEventListener("resize", sizeCanvas);

  applyConfig();
  refreshIcons();
  tickClock();
  sizeCanvas();
  drawWave();
  setInterval(tickClock, 10000);
})();
