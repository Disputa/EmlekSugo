
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import "./display.css";
import splashImage from "./nyitokep.png";

const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";

const els = {
  app: document.getElementById("app"),
  displayMinimizeBtn: document.getElementById("displayMinimizeBtn"),
  displayToggleWindowBtn: document.getElementById("displayToggleWindowBtn"),
  displayCloseBtn: document.getElementById("displayCloseBtn"),
  songTitle: document.getElementById("songTitle"),
  role: document.getElementById("role"),
  overlay: document.getElementById("overlay"),
  showList: document.getElementById("showList"),
  blockRail: document.getElementById("blockRail"),
  contentWrap: document.getElementById("contentWrap"),
  content: document.getElementById("content"),
  transportHud: document.getElementById("transportHud"),
};

if (els.app) {
  els.app.style.setProperty("--display-bg-image", `url("${splashImage}")`);
  els.app.classList.toggle("preview-mode", isPreview);
}

const runtime = {
  frameId: null,
  isPlaying: false,
  scrollPos: 0,
  contentKey: "",
  mode: "blocks",
  speed: 100,
  blocks: [],
  activeRole: "",
  blockIndex: 1,
  blockCount: 1,
  lastScrollBlockIndex: 1,
  textStyle: {
    fontSize: 42,
    offsetX: 0,
    offsetY: 0,
  },
  roleStyle: {
    fontSize: 52,
    offsetX: 0,
    offsetY: 0,
  },
};

function clearScrollAnimation() {
  if (runtime.frameId) {
    cancelAnimationFrame(runtime.frameId);
    runtime.frameId = null;
  }
}

function setOverlay(text) {
  els.overlay.textContent = text || "";
  els.overlay.style.opacity = text ? "1" : "0";
  if (text) {
    setTimeout(() => {
      els.overlay.style.opacity = "0";
    }, 900);
  }
}

function renderShowList(titles = [], currentIndex = 0, visible = false) {
  els.showList.style.display = visible ? "block" : "none";
  els.contentWrap.classList.toggle("has-show-list", visible);

  if (!visible) return;

  els.showList.innerHTML = titles
    .map((title, index) => `
      <button class="display-show-item ${index === currentIndex ? "active" : ""}" data-index="${index}">
        ${index + 1}. ${escapeHtml(title || "")}
      </button>
    `)
    .join("");

  els.showList.querySelectorAll(".display-show-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.index);
      if (!Number.isInteger(idx)) return;
      await emit("display:select-item", { index: idx });
    });
  });
}

function renderBlockRail(blocks = [], activeIndex = 0) {
  if (!els.blockRail) return;
  const hasBlocks = Array.isArray(blocks) && blocks.length > 1;
  els.blockRail.style.display = hasBlocks ? "block" : "none";
  els.contentWrap.classList.toggle("has-block-rail", hasBlocks);
  if (!hasBlocks) {
    els.blockRail.innerHTML = "";
    return;
  }

  els.blockRail.innerHTML = `
    <div class="block-rail-title">BLOKKOK</div>
    <div class="block-rail-list">
      ${blocks.map((block, index) => `
        <button class="rail-block ${index === activeIndex ? "active" : ""}" data-index="${index}">
          <span class="rail-block-index">${index + 1}</span>
          <span class="rail-block-body">
            <strong>${escapeHtml(block.role || "")}</strong>
            <span>${escapeHtml(block.text || "")}</span>
          </span>
        </button>
      `).join("")}
    </div>
  `;

  els.blockRail.querySelectorAll(".rail-block").forEach((btn) => {
    btn.addEventListener("pointerup", async (event) => {
      event.preventDefault();
      const idx = Number(btn.dataset.index);
      if (!Number.isInteger(idx)) return;
      await selectBlockFromRail(idx);
    });
  });
}

async function selectBlockFromRail(index) {
  await Promise.allSettled([
    emit("display:select-block", { index }),
    emit("display:transport", { action: "select-block", value: index }),
  ]);
}

function applyTextStyle() {
  const fontSize = Math.max(16, Number(runtime.textStyle?.fontSize) || 42);
  const offsetX = Number(runtime.textStyle?.offsetX) || 0;
  const offsetY = Number(runtime.textStyle?.offsetY) || 0;

  els.content.style.setProperty("--display-font-size", `${fontSize}px`);
  els.contentWrap.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
}

function applyRoleStyle() {
  const fontSize = Math.max(18, Number(runtime.roleStyle?.fontSize) || 52);
  const offsetX = Number(runtime.roleStyle?.offsetX) || 0;
  const offsetY = Number(runtime.roleStyle?.offsetY) || 0;

  els.role.style.fontSize = `${fontSize}px`;
  els.role.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
}

function updateTransform() {
  els.content.style.transform = `translateY(${-runtime.scrollPos}px)`;
}

function updateRoleFromScroll() {
  if (!Array.isArray(runtime.blocks) || !runtime.blocks.length) {
    els.role.textContent = "";
    return;
  }

  const sections = Array.from(els.content.querySelectorAll(".scroll-block"));
  if (!sections.length) {
    els.role.textContent = runtime.activeRole || "";
    return;
  }

  const marker = runtime.scrollPos + els.contentWrap.clientHeight * 0.5;
  let activeIndex = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].offsetTop <= marker) activeIndex = i;
  }

  runtime.activeRole = runtime.blocks[activeIndex]?.role || "";
  els.role.textContent = runtime.activeRole;
}

function renderScrollBlocks(blocks) {
  els.content.innerHTML = blocks
    .map((block, index) => `
      <section class="scroll-block" data-index="${index}">
        <div class="scroll-text">${escapeHtml(block.text || "")}</div>
      </section>
    `)
    .join('<div class="separator"></div>');
}

function getScrollTopForBlock(index) {
  const sections = Array.from(els.content.querySelectorAll(".scroll-block"));
  if (!sections.length) return 0;
  const safeIndex = Math.max(0, Math.min(index, sections.length - 1));
  return sections[safeIndex]?.offsetTop || 0;
}

function clampScrollPosition() {
  const maxScroll = Math.max(0, els.content.scrollHeight - els.contentWrap.clientHeight);
  runtime.scrollPos = Math.max(0, Math.min(maxScroll, runtime.scrollPos));
}

function startScroll(direction = "up") {
  clearScrollAnimation();

  const maxScroll = Math.max(0, els.content.scrollHeight - els.contentWrap.clientHeight);
  if (maxScroll <= 0) return;

  const pxPerFrame = Math.max(0.18, runtime.speed / 120);

  function tick() {
    if (!runtime.isPlaying) return;

    if (direction === "down") {
      runtime.scrollPos -= pxPerFrame;
      if (runtime.scrollPos < 0) runtime.scrollPos = 0;
    } else {
      runtime.scrollPos += pxPerFrame;
      if (runtime.scrollPos > maxScroll) runtime.scrollPos = maxScroll;
    }

    updateTransform();
    updateRoleFromScroll();

    const canContinue =
      (direction === "down" && runtime.scrollPos > 0) ||
      (direction !== "down" && runtime.scrollPos < maxScroll);

    if (canContinue) {
      runtime.frameId = requestAnimationFrame(tick);
    }
  }

  runtime.frameId = requestAnimationFrame(tick);
}

function renderTransportHud() {
  const playText = runtime.isPlaying ? "⏸ PILLANAT ÁLLJ" : "▶ LEJÁTSZÁS";
  const speedText = `${runtime.speed}%`;

  if (!els.transportHud) return;

  els.transportHud.innerHTML = `
    <button class="hud-btn" data-action="start">⏮ Eleje</button>
    <button class="hud-btn" data-action="prev">◀ Előző</button>
    <button class="hud-btn hud-primary" data-action="play">${playText}</button>
    <button class="hud-btn" data-action="next">▶ Következő</button>
    <button class="hud-btn" data-action="end">⏭ Vége</button>
    <button class="hud-btn" data-action="black">⬛ Black</button>
    <span class="hud-meta">Blokk: ${runtime.blockIndex}/${runtime.blockCount}</span>
    <span class="hud-meta">Seb.: ${speedText}</span>
    <input class="hud-range" type="range" min="0" max="200" step="5" value="${runtime.speed}" />
  `;

  els.transportHud.querySelectorAll(".hud-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (!action) return;
      await emit("display:transport", { action });
    });
  });

  const range = els.transportHud.querySelector(".hud-range");
  range?.addEventListener("input", async (e) => {
    const value = Number(e.target.value);
    await emit("display:transport", { action: "speed", value });
  });
}

async function invokeWindowCommand(command) {
  if (isPreview) return;
  try {
    await invoke(command);
  } catch (err) {
    console.warn(`Ablakparancs sikertelen (${command}):`, err);
  }
}

function renderState(payload) {
  const previousBlockIndex = runtime.blockIndex;
  const {
    songTitle,
    role,
    text,
    fullText,
    mode,
    black,
    speed,
    isPlaying,
    showListVisible,
    showListTitles,
    currentItemIndex,
    blocks,
    blockIndex,
    blockCount,
    textStyle,
    roleStyle,
  } = payload;

  runtime.mode = mode || "blocks";
  runtime.speed = Number(speed) || 100;
  runtime.isPlaying = !!isPlaying;
  runtime.blocks = Array.isArray(blocks) ? blocks : [];
  runtime.blockIndex = Number(blockIndex) || 1;
  runtime.blockCount = Number(blockCount) || Math.max(runtime.blocks.length, 1);
  runtime.activeRole = role || "";
  runtime.textStyle = {
    fontSize: Number(textStyle?.fontSize) || 42,
    offsetX: Number(textStyle?.offsetX) || 0,
    offsetY: Number(textStyle?.offsetY) || 0,
  };
  runtime.roleStyle = {
    fontSize: Number(roleStyle?.fontSize) || 52,
    offsetX: Number(roleStyle?.offsetX) || 0,
    offsetY: Number(roleStyle?.offsetY) || 0,
  };

  els.songTitle.textContent = songTitle || "";
  els.role.textContent = runtime.mode === "blocks" ? (role || "") : (runtime.activeRole || "");
  renderShowList(showListTitles || [], currentItemIndex || 0, !!showListVisible);
  renderBlockRail(runtime.blocks, runtime.blockIndex - 1);
  renderTransportHud();
  applyTextStyle();
  applyRoleStyle();

  clearScrollAnimation();

  if (black) {
    els.content.textContent = "";
    runtime.scrollPos = 0;
    updateTransform();
    return;
  }

  if (runtime.mode === "blocks") {
    runtime.contentKey = `block:${songTitle || ""}:${role || ""}:${text || ""}`;
    els.content.textContent = text || "";
    runtime.scrollPos = 0;
    updateTransform();
    return;
  }

  const normalizedBlocks = runtime.blocks.length
    ? runtime.blocks.map((block) => ({ role: block.role || "", text: block.text || "" }))
    : [{ role: role || "", text: fullText || text || "" }];

  const nextKey = `scroll:${songTitle || ""}:${normalizedBlocks.map((b) => `${b.role}::${b.text}`).join("||")}`;
  const contentChanged = runtime.contentKey !== nextKey;
  if (contentChanged) {
    runtime.scrollPos = runtime.mode === "scroll-down" ? 999999 : 0;
    runtime.contentKey = nextKey;
  }

  renderScrollBlocks(normalizedBlocks);

  if (contentChanged || previousBlockIndex !== runtime.blockIndex) {
    runtime.scrollPos = getScrollTopForBlock(runtime.blockIndex - 1);
  }
  clampScrollPosition();

  updateTransform();
  updateRoleFromScroll();

  if (runtime.isPlaying) {
    startScroll(runtime.mode === "scroll-down" ? "down" : "up");
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (!isPreview) {
  listen("display:block", (event) => {
    renderState(event.payload || {});
  }).catch((err) => console.warn("Display event listener hiba:", err));

  listen("display:overlay", (event) => {
    setOverlay(event.payload?.text || "");
  }).catch((err) => console.warn("Display overlay listener hiba:", err));

  emit("display:request-state", {}).catch((err) => console.warn("Display allapotkeres hiba:", err));
}

window.addEventListener("message", (event) => {
  if (event.data?.source !== "emleksugo-main") return;
  if (event.data.type === "display:block") {
    renderState(event.data.payload || {});
  }
  if (event.data.type === "display:overlay") {
    setOverlay(event.data.payload?.text || "");
  }
});

els.displayMinimizeBtn?.addEventListener("click", () => invokeWindowCommand("es_window_minimize"));
els.displayToggleWindowBtn?.addEventListener("click", () => invokeWindowCommand("es_window_toggle"));
els.displayCloseBtn?.addEventListener("click", () => invokeWindowCommand("es_window_close"));

if (isPreview) {
  window.parent?.postMessage({
    source: "emleksugo-display-preview",
    type: "display:ready",
  }, "*");
}
