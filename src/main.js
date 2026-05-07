
import JSZip from "jszip";
import "./style.css";
import splashImage from "./nyitokep.png";
import { invoke } from "@tauri-apps/api/core";
import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, emitTo, listen } from "@tauri-apps/api/event";

const DISPLAY_LABEL = "emlek-sugo-display";

const DEFAULT_TEXT_STYLE = {
  fontSize: 42,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_ROLE_STYLE = {
  fontSize: 52,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_DISPLAY_SIZE = {
  width: 1280,
  height: 720,
};

const project = {
  title: "EmlékSúgó",
  playbackMode: "blocks",
  items: [],
};

const sources = {
  showlistItems: [],
  lyricSongs: [],
  showlistFileName: "",
  lyricsFileName: "",
};

const uiPrefs = {
  showListMain: true,
  showListDisplay: false,
  openedProjectFileName: "",
  textStyle: { ...DEFAULT_TEXT_STYLE },
  roleStyle: { ...DEFAULT_ROLE_STYLE },
};

const state = {
  itemIndex: 0,
  blockIndex: 0,
  isPlaying: false,
  black: false,
  speed: 100,
  monitors: [],
  selectedMonitorIndex: 0,
};

let playbackTimer = null;

const els = {
  splashScreen: document.getElementById("splashScreen"),
  splashCard: document.getElementById("splashCard"),
  enterAppBtn: document.getElementById("enterAppBtn"),
  mainMinimizeBtn: document.getElementById("mainMinimizeBtn"),
  mainToggleWindowBtn: document.getElementById("mainToggleWindowBtn"),
  mainCloseBtn: document.getElementById("mainCloseBtn"),
  appRoot: document.getElementById("appRoot"),
  loadShowlistBtn: document.getElementById("loadShowlistBtn"),
  loadLyricsBtn: document.getElementById("loadLyricsBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  openProjectBtn: document.getElementById("openProjectBtn"),
  openHelpBtn: document.getElementById("openHelpBtn"),
  showlistInput: document.getElementById("showlistInput"),
  lyricsInput: document.getElementById("lyricsInput"),
  projectInput: document.getElementById("projectInput"),
  playbackModeSelect: document.getElementById("playbackModeSelect"),
  speedRange: document.getElementById("speedRange"),
  speedValue: document.getElementById("speedValue"),
  fontSizeRange: document.getElementById("fontSizeRange"),
  fontSizeInput: document.getElementById("fontSizeInput"),
  offsetXRange: document.getElementById("offsetXRange"),
  offsetXInput: document.getElementById("offsetXInput"),
  offsetYRange: document.getElementById("offsetYRange"),
  offsetYInput: document.getElementById("offsetYInput"),
  roleFontSizeRange: document.getElementById("roleFontSizeRange"),
  roleFontSizeInput: document.getElementById("roleFontSizeInput"),
  roleOffsetXRange: document.getElementById("roleOffsetXRange"),
  roleOffsetXInput: document.getElementById("roleOffsetXInput"),
  roleOffsetYRange: document.getElementById("roleOffsetYRange"),
  roleOffsetYInput: document.getElementById("roleOffsetYInput"),
  showListMainCheckbox: document.getElementById("showListMainCheckbox"),
  showListDisplayCheckbox: document.getElementById("showListDisplayCheckbox"),
  importStatus: document.getElementById("importStatus"),
  monitorSelect: document.getElementById("monitorSelect"),
  openDisplayBtn: document.getElementById("openDisplayBtn"),
  sendBtn: document.getElementById("sendBtn"),
  jumpStartBtn: document.getElementById("jumpStartBtn"),
  jumpEndBtn: document.getElementById("jumpEndBtn"),
  showListPanel: document.getElementById("showListPanel"),
  showList: document.getElementById("showList"),
  currentTitle: document.getElementById("currentTitle"),
  currentBlockInfo: document.getElementById("currentBlockInfo"),
  statusText: document.getElementById("statusText"),
  speedText: document.getElementById("speedText"),
  prevBtn: document.getElementById("prevBtn"),
  playBtn: document.getElementById("playBtn"),
  nextBtn: document.getElementById("nextBtn"),
  nextItemBtn: document.getElementById("nextItemBtn"),
  blackBtn: document.getElementById("blackBtn"),
  previewPanel: document.getElementById("previewPanel"),
  previewTitle: document.getElementById("previewTitle"),
  previewRole: document.getElementById("previewRole"),
  displayPreviewFrame: document.getElementById("displayPreviewFrame"),
  displayPreview: document.getElementById("displayPreview"),
  miniStage: document.getElementById("miniStage"),
  miniSongTitle: document.getElementById("miniSongTitle"),
  miniRole: document.getElementById("miniRole"),
  miniShowList: document.getElementById("miniShowList"),
  miniBlockRail: document.getElementById("miniBlockRail"),
  miniContentWrap: document.getElementById("miniContentWrap"),
  miniContent: document.getElementById("miniContent"),
  miniOverlay: document.getElementById("miniOverlay"),
  currentRole: document.getElementById("currentRole"),
  blockList: document.getElementById("blockList"),
};

let lastDisplayPayload = null;
const miniPreviewRuntime = {
  frameId: null,
  isPlaying: false,
  scrollPos: 0,
  speed: 100,
  mode: "blocks",
  blocks: [],
  activeRole: "",
  contentKey: "",
  scale: 1,
  displaySize: { ...DEFAULT_DISPLAY_SIZE },
};

function getTextStyle() {
  return {
    fontSize: clampNumber(uiPrefs.textStyle?.fontSize, DEFAULT_TEXT_STYLE.fontSize, 16, 96),
    offsetX: clampNumber(uiPrefs.textStyle?.offsetX, DEFAULT_TEXT_STYLE.offsetX, -400, 400),
    offsetY: clampNumber(uiPrefs.textStyle?.offsetY, DEFAULT_TEXT_STYLE.offsetY, -300, 300),
  };
}

function setTextStyleValue(key, rawValue) {
  if (!uiPrefs.textStyle) uiPrefs.textStyle = { ...DEFAULT_TEXT_STYLE };
  const limits = {
    fontSize: [16, 96],
    offsetX: [-400, 400],
    offsetY: [-300, 300],
  };
  const [min, max] = limits[key];
  uiPrefs.textStyle[key] = clampNumber(rawValue, DEFAULT_TEXT_STYLE[key], min, max);
}

function getRoleStyle() {
  return {
    fontSize: clampNumber(uiPrefs.roleStyle?.fontSize, DEFAULT_ROLE_STYLE.fontSize, 18, 96),
    offsetX: clampNumber(uiPrefs.roleStyle?.offsetX, DEFAULT_ROLE_STYLE.offsetX, -500, 500),
    offsetY: clampNumber(uiPrefs.roleStyle?.offsetY, DEFAULT_ROLE_STYLE.offsetY, -220, 360),
  };
}

function setRoleStyleValue(key, rawValue) {
  if (!uiPrefs.roleStyle) uiPrefs.roleStyle = { ...DEFAULT_ROLE_STYLE };
  const limits = {
    fontSize: [18, 96],
    offsetX: [-500, 500],
    offsetY: [-220, 360],
  };
  const [min, max] = limits[key];
  uiPrefs.roleStyle[key] = clampNumber(rawValue, DEFAULT_ROLE_STYLE[key], min, max);
}

function applyTextStyleToPreviewElements() {
  updatePreviewPayload();
}

async function updateTextStyleAndSync(key, value) {
  setTextStyleValue(key, value);
  syncControlValuesFromState();
  renderPreview();
  await syncDisplay();
}

async function updateRoleStyleAndSync(key, value) {
  setRoleStyleValue(key, value);
  syncControlValuesFromState();
  renderPreview();
  await syncDisplay();
}


init().catch(console.error);

async function init() {
  if (els.displayPreview) {
    els.displayPreview.style.setProperty("--display-bg-image", `url("${splashImage}")`);
    updateMiniPreviewScale();
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => {
        updateMiniPreviewScale();
        updatePreviewPayload();
      }).observe(els.displayPreview);
    }
  }
  setupSplash();
  bindUi();
  await bindDisplaySelectionListener();
  await loadMonitors();
  syncControlValuesFromState();
  updateImportStatus();
  updateMainShowListVisibility();
  renderAll();

  if (!els.splashScreen || !els.enterAppBtn) {
    revealMainApp();
    await ensureMainFullscreen();
  }
}

function setupSplash() {
  if (!els.splashScreen) return;

  els.splashScreen.style.backgroundImage =
    `linear-gradient(rgba(4,6,20,0.25), rgba(4,6,20,0.6)), url('${splashImage}')`;
  els.splashScreen.style.backgroundSize = "cover";
  els.splashScreen.style.backgroundPosition = "center center";
  els.splashScreen.style.backgroundRepeat = "no-repeat";
}

function revealMainApp() {
  if (els.splashScreen) {
    els.splashScreen.classList.add("hidden");
  }
  if (els.appRoot) {
    els.appRoot.classList.remove("hidden");
  }
}

function bindUi() {
  els.enterAppBtn?.addEventListener("click", async () => {
    revealMainApp();
    await ensureMainFullscreen();
  });

  els.loadShowlistBtn?.addEventListener("click", () => els.showlistInput?.click());
  els.loadLyricsBtn?.addEventListener("click", () => els.lyricsInput?.click());
  els.saveProjectBtn?.addEventListener("click", () => saveProjectToFile());
  els.openProjectBtn?.addEventListener("click", () => els.projectInput?.click());
  els.openHelpBtn?.addEventListener("click", () => openHelpWindow());
  els.mainMinimizeBtn?.addEventListener("click", () => invokeWindowCommand("es_window_minimize"));
  els.mainToggleWindowBtn?.addEventListener("click", () => invokeWindowCommand("es_window_toggle"));
  els.mainCloseBtn?.addEventListener("click", () => invokeWindowCommand("es_window_close"));

  els.showlistInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readImportedText(file);
      sources.showlistItems = parseShowlistText(text);
      sources.showlistFileName = file.name;
      rebuildProjectFromSources();
      updateImportStatus();
      await flashOverlay(`Műsorrend betöltve: ${sources.showlistItems.length} tétel`);
    } catch (err) {
      console.error(err);
      alert("A műsorrend fájl nem olvasható be.");
    }
    e.target.value = "";
  });

  els.lyricsInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readImportedText(file);
      sources.lyricSongs = parseLyricsBookText(text);
      sources.lyricsFileName = file.name;
      rebuildProjectFromSources();
      updateImportStatus();
      await flashOverlay(`Szövegkönyv betöltve: ${sources.lyricSongs.length} dal`);
    } catch (err) {
      console.error(err);
      alert("A szövegkönyv fájl nem olvasható be.");
    }
    e.target.value = "";
  });

  els.projectInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      loadProjectFromObject(data);
      updateImportStatus(file.name);
      syncControlValuesFromState();
      updateMainShowListVisibility();
      renderAll();
      await syncDisplay();
      await flashOverlay("Projekt megnyitva");
    } catch (err) {
      console.error(err);
      alert("A projektfájl nem olvasható be.");
    }
    e.target.value = "";
  });

  els.playbackModeSelect?.addEventListener("change", async (e) => {
    project.playbackMode = e.target.value;
    updateImportStatus();
    await syncDisplay();
    await flashOverlay(getPlaybackModeLabel(project.playbackMode));
  });

  els.speedRange?.addEventListener("input", async (e) => {
    state.speed = clampNumber(e.target.value, 100, 0, 200);
    syncControlValuesFromState();
    renderStatusOnly();
    restartPlaybackTimerIfNeeded();
    await syncDisplay();
  });

  bindTextStyleControl(els.fontSizeRange, "fontSize");
  bindTextStyleControl(els.fontSizeInput, "fontSize");
  bindTextStyleControl(els.offsetXRange, "offsetX");
  bindTextStyleControl(els.offsetXInput, "offsetX");
  bindTextStyleControl(els.offsetYRange, "offsetY");
  bindTextStyleControl(els.offsetYInput, "offsetY");
  bindRoleStyleControl(els.roleFontSizeRange, "fontSize");
  bindRoleStyleControl(els.roleFontSizeInput, "fontSize");
  bindRoleStyleControl(els.roleOffsetXRange, "offsetX");
  bindRoleStyleControl(els.roleOffsetXInput, "offsetX");
  bindRoleStyleControl(els.roleOffsetYRange, "offsetY");
  bindRoleStyleControl(els.roleOffsetYInput, "offsetY");

  els.showListMainCheckbox?.addEventListener("change", () => {
    uiPrefs.showListMain = !!els.showListMainCheckbox.checked;
    updateMainShowListVisibility();
  });

  els.showListDisplayCheckbox?.addEventListener("change", async () => {
    uiPrefs.showListDisplay = !!els.showListDisplayCheckbox.checked;
    await syncDisplay();
  });

  els.monitorSelect?.addEventListener("change", (e) => {
    state.selectedMonitorIndex = Number(e.target.value);
    updatePreviewPayload();
  });

  els.openDisplayBtn?.addEventListener("click", async () => {
    await openDisplayOnSelectedMonitor();
    await syncDisplay();
    await flashOverlay("▶ Kijelző aktív");
  });

  els.sendBtn?.addEventListener("click", async () => {
    await syncDisplay();
    await flashOverlay("⤴ Aktuális blokk küldve");
  });

  els.jumpStartBtn?.addEventListener("click", async () => {
    await jumpToBlockBoundary("start");
  });

  els.prevBtn?.addEventListener("click", async () => {
    await moveBlockSelection(-1, "⏮ Előző blokk");
  });

  els.nextBtn?.addEventListener("click", async () => {
    await moveBlockSelection(1, "⏭ Következő blokk");
  });

  els.jumpEndBtn?.addEventListener("click", async () => {
    await jumpToBlockBoundary("end");
  });

  els.nextItemBtn?.addEventListener("click", async () => {
    await jumpToNextItem();
  });

  els.playBtn?.addEventListener("click", async () => {
    await togglePlayPause();
  });

  els.blackBtn?.addEventListener("click", async () => {
    await toggleBlack();
  });

  els.displayPreviewFrame?.addEventListener("load", () => {
    resizePreviewFrame();
    updatePreviewPayload();
  });
  window.addEventListener("resize", () => {
    resizePreviewFrame();
    updateMiniPreviewScale();
    updatePreviewPayload();
  });
  window.addEventListener("message", (event) => {
    if (event.data?.source !== "emleksugo-display-preview") return;
    if (event.data.type === "display:ready") {
      resizePreviewFrame();
      updatePreviewPayload();
    }
  });

  window.addEventListener("keydown", async (e) => {
    const target = e.target;
    const isEditing =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;

    if (isEditing || e.repeat) return;

    if (e.code === "Home") {
      e.preventDefault();
      await jumpToBlockBoundary("start");
      return;
    }
    if (e.code === "End") {
      e.preventDefault();
      await jumpToBlockBoundary("end");
      return;
    }
    if (e.code === "PageDown") {
      e.preventDefault();
      await jumpToNextItem();
      return;
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      await moveBlockSelection(-1, "⏮ Előző blokk");
      return;
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      await moveBlockSelection(1, "⏭ Következő blokk");
      return;
    }
    if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      await togglePlayPause();
      return;
    }
    if (e.code === "ArrowUp") {
      e.preventDefault();
      state.speed = Math.min(200, state.speed + 5);
      syncControlValuesFromState();
      renderStatusOnly();
      restartPlaybackTimerIfNeeded();
      await syncDisplay();
      return;
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      state.speed = Math.max(0, state.speed - 5);
      syncControlValuesFromState();
      renderStatusOnly();
      restartPlaybackTimerIfNeeded();
      await syncDisplay();
      return;
    }
    if (e.code === "KeyB") {
      e.preventDefault();
      await toggleBlack();
    }
  });
}

function bindTextStyleControl(element, key) {
  element?.addEventListener("input", async (e) => {
    await updateTextStyleAndSync(key, e.target.value);
  });
}

function bindRoleStyleControl(element, key) {
  element?.addEventListener("input", async (e) => {
    await updateRoleStyleAndSync(key, e.target.value);
  });
}

async function invokeWindowCommand(command) {
  try {
    await invoke(command);
  } catch (err) {
    console.warn(`Ablakparancs sikertelen (${command}):`, err);
  }
}

async function openHelpWindow() {
  try {
    let helpWindow = await WebviewWindow.getByLabel("emlek-sugo-help");
    if (!helpWindow) {
      helpWindow = new WebviewWindow("emlek-sugo-help", {
        url: "help.html",
        title: "EmlékSúgó Súgó",
        decorations: true,
        focus: true,
        visible: true,
        resizable: true,
        width: 1180,
        height: 820,
      });
      await new Promise((resolve, reject) => {
        helpWindow.once("tauri://created", () => resolve());
        helpWindow.once("tauri://error", (error) => reject(error));
      });
    }
    try { await helpWindow.show(); } catch {}
    try { await helpWindow.setFocus(); } catch {}
  } catch (err) {
    console.warn("Súgó ablak nem nyitható, böngészős fallback:", err);
    window.open("help.html", "_blank", "noopener,noreferrer");
  }
}

function resizePreviewFrame() {
  const frame = els.displayPreviewFrame;
  const holder = frame?.parentElement;
  if (!frame || !holder) return;
  const scale = holder.clientWidth / 1280;
  holder.style.setProperty("--preview-scale", String(scale));
  holder.style.height = `${720 * scale}px`;
}

function updateMiniPreviewScale() {
  if (!els.displayPreview) return;
  const displaySize = miniPreviewRuntime.displaySize || DEFAULT_DISPLAY_SIZE;
  const width = Math.max(1, Number(displaySize.width) || DEFAULT_DISPLAY_SIZE.width);
  const height = Math.max(1, Number(displaySize.height) || DEFAULT_DISPLAY_SIZE.height);
  els.displayPreview.style.aspectRatio = `${width} / ${height}`;
  const scale = els.displayPreview.clientWidth > 0
    ? els.displayPreview.clientWidth / width
    : 1;
  miniPreviewRuntime.scale = scale;
  els.displayPreview.style.setProperty("--mini-scale", String(scale));
  if (els.miniStage) {
    els.miniStage.style.width = `${width}px`;
    els.miniStage.style.height = `${height}px`;
    els.miniStage.style.transform = `scale(${scale})`;
  }
}

async function bindDisplaySelectionListener() {
  await listen("display:request-state", async () => {
    await syncDisplay();
  });

  await listen("display:select-item", async (event) => {
    const idx = Number(event.payload?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= project.items.length) return;
    state.itemIndex = idx;
    state.blockIndex = 0;
    state.black = false;
    renderAll();
    await syncDisplay();
    restartPlaybackTimerIfNeeded();
  });

  await listen("display:select-block", async (event) => {
    await selectDisplayBlock(Number(event.payload?.index));
  });

  await listen("display:transport", async (event) => {
    const action = String(event.payload?.action || "");
    const value = event.payload?.value;
    if (!action) return;

    switch (action) {
      case "start":
        await jumpToBlockBoundary("start");
        break;
      case "prev":
        await moveBlockSelection(-1, "⏮ Előző blokk");
        break;
      case "play":
        await togglePlayPause();
        break;
      case "next":
        await moveBlockSelection(1, "⏭ Következő blokk");
        break;
      case "end":
        await jumpToBlockBoundary("end");
        break;
      case "black":
        await toggleBlack();
        break;
      case "speed":
        state.speed = clampNumber(value, state.speed, 0, 200);
        syncControlValuesFromState();
        renderStatusOnly();
        restartPlaybackTimerIfNeeded();
        await syncDisplay();
        break;
      case "select-block":
        await selectDisplayBlock(Number(value));
        break;
      default:
        break;
    }
  });
}

async function selectDisplayBlock(idx) {
  const item = getCurrentItem();
  if (!item || !Number.isInteger(idx) || idx < 0 || idx >= item.blocks.length) return;
  state.blockIndex = idx;
  state.black = false;
  renderAll();
  await syncDisplay();
  restartPlaybackTimerIfNeeded();
}

function syncControlValuesFromState() {
  const textStyle = getTextStyle();
  const roleStyle = getRoleStyle();
  if (els.playbackModeSelect) els.playbackModeSelect.value = project.playbackMode;
  if (els.speedRange) els.speedRange.value = String(state.speed);
  if (els.speedValue) els.speedValue.textContent = `${state.speed}%`;
  if (els.fontSizeRange) els.fontSizeRange.value = String(textStyle.fontSize);
  if (els.fontSizeInput) els.fontSizeInput.value = String(textStyle.fontSize);
  if (els.offsetXRange) els.offsetXRange.value = String(textStyle.offsetX);
  if (els.offsetXInput) els.offsetXInput.value = String(textStyle.offsetX);
  if (els.offsetYRange) els.offsetYRange.value = String(textStyle.offsetY);
  if (els.offsetYInput) els.offsetYInput.value = String(textStyle.offsetY);
  if (els.roleFontSizeRange) els.roleFontSizeRange.value = String(roleStyle.fontSize);
  if (els.roleFontSizeInput) els.roleFontSizeInput.value = String(roleStyle.fontSize);
  if (els.roleOffsetXRange) els.roleOffsetXRange.value = String(roleStyle.offsetX);
  if (els.roleOffsetXInput) els.roleOffsetXInput.value = String(roleStyle.offsetX);
  if (els.roleOffsetYRange) els.roleOffsetYRange.value = String(roleStyle.offsetY);
  if (els.roleOffsetYInput) els.roleOffsetYInput.value = String(roleStyle.offsetY);
  if (els.showListMainCheckbox) els.showListMainCheckbox.checked = uiPrefs.showListMain;
  if (els.showListDisplayCheckbox) els.showListDisplayCheckbox.checked = uiPrefs.showListDisplay;
}

function renderAll() {
  renderShowList();
  renderStatusOnly();
  renderPreview();
  renderBlockEditor();
}

function renderStatusOnly() {
  const item = getCurrentItem();
  const block = getCurrentBlock();
  if (els.currentTitle) els.currentTitle.textContent = item?.title || "-";
  if (els.currentBlockInfo) {
    els.currentBlockInfo.textContent = item ? `${state.blockIndex + 1} / ${item.blocks.length}` : "-";
  }
  if (els.statusText) {
    els.statusText.textContent = state.black ? "BLACK" : state.isPlaying ? "PLAY" : "PAUSE";
  }
  if (els.speedText) els.speedText.textContent = `${state.speed}%`;
  if (els.currentRole) els.currentRole.textContent = block?.role || "";
}

function renderPreview() {
  const item = getCurrentItem();
  const block = getCurrentBlock();
  if (els.previewTitle) els.previewTitle.textContent = item?.title || "Nincs kiválasztott szám";
  if (els.previewRole) els.previewRole.textContent = block?.role || "";
  updatePreviewPayload();
}

function renderBlockEditor() {
  const item = getCurrentItem();
  if (!els.blockList) return;

  if (!item) {
    els.blockList.innerHTML = `<div class="block-item">Nincs betöltött műsorrend.</div>`;
    return;
  }

  els.blockList.innerHTML = item.blocks
    .map((block, index) => `
      <div class="block-item ${index === state.blockIndex ? "active" : ""}" data-index="${index}">
        <div class="block-toolbar">
          <input class="block-role-input" data-index="${index}" value="${escapeAttribute(block.role || "")}" placeholder="Megszólaló neve" />
          <button class="move-up-btn" data-index="${index}" type="button">↑</button>
          <button class="move-down-btn" data-index="${index}" type="button">↓</button>
        </div>
        <textarea class="block-text-input" data-index="${index}" rows="5">${escapeHtml(block.text || "")}</textarea>
      </div>
    `)
    .join("");

  els.blockList.querySelectorAll(".block-item").forEach((card) => {
    card.addEventListener("click", async (e) => {
      if (e.target.closest("button, input, textarea")) return;
      state.blockIndex = Number(card.dataset.index);
      renderAll();
      await syncDisplay();
    });
  });

  els.blockList.querySelectorAll(".block-role-input").forEach((input) => {
    input.addEventListener("input", async () => {
      const idx = Number(input.dataset.index);
      item.blocks[idx].role = input.value;
      if (idx === state.blockIndex) {
        renderStatusOnly();
        renderPreview();
        await syncDisplay();
      }
    });
  });

  els.blockList.querySelectorAll(".block-text-input").forEach((textarea) => {
    textarea.addEventListener("input", async () => {
      const idx = Number(textarea.dataset.index);
      item.blocks[idx].text = textarea.value;
      if (idx === state.blockIndex) {
        renderPreview();
        await syncDisplay();
        restartPlaybackTimerIfNeeded();
      }
    });
  });

  els.blockList.querySelectorAll(".move-up-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await reorderBlock(Number(btn.dataset.index), -1);
    });
  });

  els.blockList.querySelectorAll(".move-down-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await reorderBlock(Number(btn.dataset.index), 1);
    });
  });
}

function renderShowList() {
  if (els.showListPanel) {
    els.showListPanel.classList.toggle("hidden", !uiPrefs.showListMain);
  }
  if (!uiPrefs.showListMain || !els.showList) return;

  els.showList.innerHTML = project.items
    .map((item, index) => `
      <button class="show-item ${index === state.itemIndex ? "active" : ""}" data-index="${index}">
        <span class="show-item-title">${index + 1}. ${escapeHtml(item.title)}</span>
        <span class="show-item-meta">${escapeHtml(item.duration || (item.type === "announcement" ? "bejelentés" : ""))}</span>
      </button>
    `)
    .join("");

  els.showList.querySelectorAll(".show-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.itemIndex = Number(btn.dataset.index);
      state.blockIndex = 0;
      state.black = false;
      renderAll();
      await syncDisplay();
      restartPlaybackTimerIfNeeded();
    });
  });
}

function updateMainShowListVisibility() {
  if (els.showListPanel) {
    els.showListPanel.classList.toggle("hidden", !uiPrefs.showListMain);
  }
}

function getCurrentItem() {
  return project.items[state.itemIndex] || null;
}

function getCurrentBlock() {
  const item = getCurrentItem();
  return item?.blocks?.[state.blockIndex] || null;
}

async function jumpToBlockBoundary(where) {
  const item = getCurrentItem();
  if (!item) return;
  state.blockIndex = where === "end" ? Math.max(0, item.blocks.length - 1) : 0;
  state.black = false;
  renderAll();
  await syncDisplay();
  await flashOverlay(where === "end" ? "⏭ Felirat vége" : "⏮ Felirat eleje");
  restartPlaybackTimerIfNeeded();
}

async function moveBlockSelection(delta, overlayText) {
  const item = getCurrentItem();
  if (!item) return;
  const nextIndex = Math.max(0, Math.min(item.blocks.length - 1, state.blockIndex + delta));
  if (nextIndex === state.blockIndex) return;
  state.blockIndex = nextIndex;
  state.black = false;
  renderAll();
  await syncDisplay();
  if (overlayText) await flashOverlay(overlayText);
  restartPlaybackTimerIfNeeded();
}

async function jumpToNextItem() {
  if (!project.items.length) return;
  const nextIndex = Math.min(project.items.length - 1, state.itemIndex + 1);
  if (nextIndex === state.itemIndex) return;
  state.itemIndex = nextIndex;
  state.blockIndex = 0;
  state.black = false;
  renderAll();
  await syncDisplay();
  await flashOverlay("⏭ Következő dal eleje");
  restartPlaybackTimerIfNeeded();
}

async function reorderBlock(index, direction) {
  const item = getCurrentItem();
  if (!item) return;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= item.blocks.length) return;
  const moved = item.blocks.splice(index, 1)[0];
  item.blocks.splice(nextIndex, 0, moved);
  state.blockIndex = nextIndex;
  renderAll();
  await syncDisplay();
}

async function togglePlayPause() {
  state.isPlaying = !state.isPlaying;
  renderStatusOnly();
  await syncDisplay();
  await flashOverlay(state.isPlaying ? "▶ Lejátszás" : "⏸ Pillanat állj");
  restartPlaybackTimerIfNeeded();
}

async function toggleBlack() {
  state.black = !state.black;
  renderStatusOnly();
  await syncDisplay();
  await flashOverlay(state.black ? "⬛ Black" : "⬜ Vissza a szövegre");
}

function clearPlaybackTimer() {
  if (playbackTimer) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
}

function restartPlaybackTimerIfNeeded() {
  clearPlaybackTimer();
  if (!state.isPlaying || state.black) return;
  if (project.playbackMode !== "blocks") return;

  const item = getCurrentItem();
  const block = getCurrentBlock();
  if (!item || !block) return;
  if (state.blockIndex >= item.blocks.length - 1) return;

  const ms = estimateBlockDuration(block.text || "");
  playbackTimer = setTimeout(async () => {
    if (!state.isPlaying || state.black) return;
    const nextIndex = state.blockIndex + 1;
    if (!project.items[state.itemIndex] || nextIndex > project.items[state.itemIndex].blocks.length - 1) return;
    state.blockIndex = nextIndex;
    renderAll();
    await syncDisplay();
    restartPlaybackTimerIfNeeded();
  }, ms);
}

function estimateBlockDuration(text) {
  const chars = Math.max(String(text || "").replace(/\s+/g, " ").trim().length, 12);
  const base = Math.max(1600, chars * 55);
  if (state.speed <= 0) return 99999999;
  return Math.round(base * (100 / state.speed));
}

async function loadMonitors() {
  const monitors = await availableMonitors();
  const current = await currentMonitor();
  state.monitors = monitors;
  let preferredIndex = 0;

  if (current && monitors.length > 1) {
    const idx = monitors.findIndex(
      (m) => m.position.x !== current.position.x || m.position.y !== current.position.y
    );
    preferredIndex = idx >= 0 ? idx : 0;
  }

  if (els.monitorSelect) {
    els.monitorSelect.innerHTML = monitors
      .map((monitor, index) => {
        const isCurrent = current && monitor.position.x === current.position.x && monitor.position.y === current.position.y;
        const label = monitor.name || `Monitor ${index + 1}`;
        return `<option value="${index}" ${index === preferredIndex ? "selected" : ""}>${escapeHtml(label)}${isCurrent ? " (jelenlegi)" : ""}</option>`;
      })
      .join("");
  }
  state.selectedMonitorIndex = preferredIndex;
}

async function ensureDisplayWindow() {
  let displayWindow = await WebviewWindow.getByLabel(DISPLAY_LABEL);
  if (displayWindow) {
    try { await displayWindow.show(); } catch {}
    return displayWindow;
  }

  displayWindow = new WebviewWindow(DISPLAY_LABEL, {
    url: "display.html",
    title: "EmlékSúgó Display",
    decorations: true,
    focus: true,
    visible: true,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    width: 1280,
    height: 720,
  });

  await new Promise((resolve, reject) => {
    displayWindow.once("tauri://created", () => resolve());
    displayWindow.once("tauri://error", (error) => reject(error));
  });

  await sleep(250);
  return displayWindow;
}

async function openDisplayOnSelectedMonitor() {
  const monitor = state.monitors[state.selectedMonitorIndex];
  if (!monitor) return;

  const displayWindow = await ensureDisplayWindow();
  try { await displayWindow.setFullscreen(false); } catch {}
  try { await displayWindow.setSize(new PhysicalSize(monitor.size.width, monitor.size.height)); } catch {}
  try { await displayWindow.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y)); } catch {}
  try { await displayWindow.show(); } catch {}
  try { await displayWindow.setFocus(); } catch {}
  try { await displayWindow.setFullscreen(true); } catch {}
  await sleep(150);
}

async function ensureMainFullscreen() {
  try {
    const appWindow = getCurrentWindow();
    try { await appWindow.show(); } catch {}
    try { await appWindow.setFocus(); } catch {}
    try { await appWindow.maximize(); } catch {}
    try { await appWindow.setFullscreen(true); } catch {}
  } catch (err) {
    console.warn("Főablak fullscreen nem sikerült:", err);
  }
}

async function syncDisplay() {
  const payload = getDisplayPayload();
  if (!payload) return;

  lastDisplayPayload = payload;
  renderMiniPreview(payload);
  postPreviewState();

  try {
    await Promise.allSettled([
      emitTo(DISPLAY_LABEL, "display:block", payload),
      emit("display:block", payload),
    ]);
  } catch (err) {
    console.warn("Display2 blokk küldés sikertelen:", err);
  }
}

async function flashOverlay(text) {
  setMiniOverlay(text);
  postPreviewOverlay(text);
  try {
    await Promise.allSettled([
      emitTo(DISPLAY_LABEL, "display:overlay", { text }),
      emit("display:overlay", { text }),
    ]);
  } catch {}
}

function getDisplayPayload() {
  const item = getCurrentItem();
  const block = getCurrentBlock();
  if (!item || !block) return null;
  const displaySize = getSelectedDisplaySize();

  return {
    songTitle: item.title,
    role: block.role || "",
    text: block.text || "",
    fullText: buildFullTextForItem(item),
    mode: project.playbackMode,
    black: state.black,
    speed: state.speed,
    isPlaying: state.isPlaying,
    blockIndex: state.blockIndex + 1,
    blockCount: item.blocks.length,
    showListVisible: uiPrefs.showListDisplay,
    showListTitles: project.items.map((it) => it.title),
    currentItemIndex: state.itemIndex,
    blocks: item.blocks.map((entry) => ({ role: entry.role || "", text: entry.text || "" })),
    textStyle: getTextStyle(),
    roleStyle: getRoleStyle(),
    displaySize,
  };
}

function getSelectedDisplaySize() {
  const monitor = state.monitors[state.selectedMonitorIndex];
  const width = Number(monitor?.size?.width) || DEFAULT_DISPLAY_SIZE.width;
  const height = Number(monitor?.size?.height) || DEFAULT_DISPLAY_SIZE.height;
  return { width, height };
}

function postPreviewState() {
  if (!els.displayPreviewFrame?.contentWindow || !lastDisplayPayload) return;
  els.displayPreviewFrame.contentWindow.postMessage({
    source: "emleksugo-main",
    type: "display:block",
    payload: lastDisplayPayload,
  }, "*");
}

function updatePreviewPayload() {
  const payload = getDisplayPayload();
  if (!payload) return;
  lastDisplayPayload = payload;
  renderMiniPreview(payload);
  postPreviewState();
}

function postPreviewOverlay(text) {
  if (!els.displayPreviewFrame?.contentWindow) return;
  els.displayPreviewFrame.contentWindow.postMessage({
    source: "emleksugo-main",
    type: "display:overlay",
    payload: { text },
  }, "*");
}

function renderMiniPreview(payload) {
  if (!els.displayPreview || !payload) return;
  updateMiniPreviewScale();
  const previousBlockIndex = miniPreviewRuntime.blockIndex || 1;

  const {
    songTitle,
    role,
    text,
    fullText,
    mode,
    black,
    speed,
    isPlaying,
    blocks,
    blockIndex,
    showListTitles,
    currentItemIndex,
    showListVisible,
    textStyle,
    roleStyle,
    displaySize,
  } = payload;

  miniPreviewRuntime.displaySize = {
    width: Number(displaySize?.width) || DEFAULT_DISPLAY_SIZE.width,
    height: Number(displaySize?.height) || DEFAULT_DISPLAY_SIZE.height,
  };
  updateMiniPreviewScale();
  miniPreviewRuntime.isPlaying = !!isPlaying;
  miniPreviewRuntime.mode = mode || "blocks";
  miniPreviewRuntime.speed = Number(speed) || 100;
  miniPreviewRuntime.blocks = Array.isArray(blocks) ? blocks : [];
  miniPreviewRuntime.activeRole = role || "";
  miniPreviewRuntime.blockIndex = Number(blockIndex) || 1;

  els.displayPreview.classList.toggle("is-black", !!black);
  if (els.miniSongTitle) els.miniSongTitle.textContent = songTitle || "";
  if (els.miniRole) els.miniRole.textContent = role || "";
  renderMiniShowList(showListTitles || [], currentItemIndex || 0, !!showListVisible);
  renderMiniBlockRail(miniPreviewRuntime.blocks, (Number(blockIndex) || 1) - 1);
  els.miniContentWrap?.classList.toggle("has-show-list", !!showListVisible);
  els.miniContentWrap?.classList.toggle("has-block-rail", miniPreviewRuntime.blocks.length > 1);
  applyMiniTextStyle(textStyle);
  applyMiniRoleStyle(roleStyle);
  clearMiniPreviewScroll();

  if (black) {
    if (els.miniContent) els.miniContent.textContent = "";
    return;
  }

  if (miniPreviewRuntime.mode === "blocks") {
    miniPreviewRuntime.contentKey = `block:${songTitle || ""}:${role || ""}:${text || ""}`;
    if (els.miniContent) {
      els.miniContent.innerHTML = "";
      els.miniContent.textContent = text || "";
      els.miniContent.style.transform = "translateY(0px)";
    }
    miniPreviewRuntime.scrollPos = 0;
    return;
  }

  const normalizedBlocks = miniPreviewRuntime.blocks.length
    ? miniPreviewRuntime.blocks.map((block) => ({ role: block.role || "", text: block.text || "" }))
    : [{ role: role || "", text: fullText || text || "" }];

  const nextKey = `scroll:${songTitle || ""}:${normalizedBlocks.map((block) => `${block.role}::${block.text}`).join("||")}`;
  const contentChanged = miniPreviewRuntime.contentKey !== nextKey;
  if (contentChanged) {
    miniPreviewRuntime.scrollPos = miniPreviewRuntime.mode === "scroll-down" ? 999999 : 0;
    miniPreviewRuntime.contentKey = nextKey;
  }

  renderMiniScrollBlocks(normalizedBlocks);
  if (contentChanged || previousBlockIndex !== miniPreviewRuntime.blockIndex) {
    miniPreviewRuntime.scrollPos = getMiniScrollTopForBlock(miniPreviewRuntime.blockIndex - 1);
  }
  clampMiniScrollPosition();
  updateMiniTransform();
  updateMiniRoleFromScroll();

  if (miniPreviewRuntime.isPlaying) {
    startMiniPreviewScroll(miniPreviewRuntime.mode === "scroll-down" ? "down" : "up");
  }
}

function renderMiniShowList(titles, activeIndex, visible) {
  if (!els.miniShowList) return;
  els.miniShowList.classList.toggle("visible", !!visible);
  els.miniShowList.innerHTML = titles
    .map((title, index) => `
      <div class="mini-show-item ${index === activeIndex ? "active" : ""}">
        <span>${index + 1}. ${escapeHtml(title)}</span>
      </div>
    `)
    .join("");
}

function renderMiniBlockRail(blocks, activeIndex) {
  if (!els.miniBlockRail) return;
  els.miniBlockRail.innerHTML = `
    <div class="mini-rail-title">BLOKKOK</div>
    ${blocks.map((block, index) => `
      <div class="mini-rail-block ${index === activeIndex ? "active" : ""}">
        <span class="mini-rail-index">${index + 1}</span>
        <span class="mini-rail-text">
          <strong>${escapeHtml(block.role || "")}</strong>
          <span>${escapeHtml(block.text || "")}</span>
        </span>
      </div>
    `).join("")}
  `;
}

function applyMiniTextStyle(textStyle = {}) {
  if (!els.miniContentWrap) return;
  const fontSize = clampNumber(textStyle.fontSize, DEFAULT_TEXT_STYLE.fontSize, 16, 96);
  const offsetX = clampNumber(textStyle.offsetX, DEFAULT_TEXT_STYLE.offsetX, -400, 400);
  const offsetY = clampNumber(textStyle.offsetY, DEFAULT_TEXT_STYLE.offsetY, -300, 300);
  els.miniContentWrap.style.setProperty("--mini-font-size", `${fontSize}px`);
  els.miniContentWrap.style.setProperty("--mini-offset-x", `${offsetX}px`);
  els.miniContentWrap.style.setProperty("--mini-offset-y", `${offsetY}px`);
}

function applyMiniRoleStyle(roleStyle = {}) {
  if (!els.miniRole) return;
  const fontSize = clampNumber(roleStyle.fontSize, DEFAULT_ROLE_STYLE.fontSize, 18, 96);
  const offsetX = clampNumber(roleStyle.offsetX, DEFAULT_ROLE_STYLE.offsetX, -500, 500);
  const offsetY = clampNumber(roleStyle.offsetY, DEFAULT_ROLE_STYLE.offsetY, -220, 360);
  els.miniRole.style.fontSize = `${fontSize}px`;
  els.miniRole.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
}

function renderMiniScrollBlocks(blocks) {
  if (!els.miniContent) return;
  els.miniContent.innerHTML = blocks
    .map((block) => `
      <section class="mini-scroll-block" data-role="${escapeAttribute(block.role || "")}">
        <div>${escapeHtml(block.text || "")}</div>
      </section>
    `)
    .join('<div class="mini-separator"></div>');
}

function startMiniPreviewScroll(direction = "up") {
  clearMiniPreviewScroll();
  const tick = () => {
    const maxScroll = getMiniMaxScroll();
    const step = Math.max(0.18, miniPreviewRuntime.speed / 120);
    miniPreviewRuntime.scrollPos += direction === "down" ? -step : step;
    miniPreviewRuntime.scrollPos = Math.max(0, Math.min(maxScroll, miniPreviewRuntime.scrollPos));
    updateMiniTransform();
    updateMiniRoleFromScroll();

    const canContinue =
      (direction === "down" && miniPreviewRuntime.scrollPos > 0) ||
      (direction !== "down" && miniPreviewRuntime.scrollPos < maxScroll);
    if (miniPreviewRuntime.isPlaying && canContinue) {
      miniPreviewRuntime.frameId = requestAnimationFrame(tick);
    }
  };
  miniPreviewRuntime.frameId = requestAnimationFrame(tick);
}

function clearMiniPreviewScroll() {
  if (miniPreviewRuntime.frameId) {
    cancelAnimationFrame(miniPreviewRuntime.frameId);
    miniPreviewRuntime.frameId = null;
  }
}

function getMiniMaxScroll() {
  if (!els.miniContent || !els.miniContentWrap) return 0;
  return Math.max(0, els.miniContent.scrollHeight - els.miniContentWrap.clientHeight);
}

function getMiniScrollTopForBlock(index) {
  const sections = Array.from(els.miniContent?.querySelectorAll(".mini-scroll-block") || []);
  if (!sections.length) return 0;
  const safeIndex = Math.max(0, Math.min(index, sections.length - 1));
  return sections[safeIndex]?.offsetTop || 0;
}

function clampMiniScrollPosition() {
  miniPreviewRuntime.scrollPos = Math.max(0, Math.min(getMiniMaxScroll(), miniPreviewRuntime.scrollPos));
}

function updateMiniTransform() {
  if (els.miniContent) {
    els.miniContent.style.transform = `translateY(${-miniPreviewRuntime.scrollPos}px)`;
  }
}

function updateMiniRoleFromScroll() {
  if (!els.miniRole) return;
  const sections = Array.from(els.miniContent?.querySelectorAll(".mini-scroll-block") || []);
  if (!sections.length) {
    els.miniRole.textContent = miniPreviewRuntime.activeRole || "";
    return;
  }
  const marker = miniPreviewRuntime.scrollPos + (els.miniContentWrap?.clientHeight || 0) * 0.5;
  let activeIndex = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].offsetTop <= marker) activeIndex = i;
  }
  miniPreviewRuntime.activeRole = miniPreviewRuntime.blocks[activeIndex]?.role || sections[activeIndex]?.dataset.role || "";
  els.miniRole.textContent = miniPreviewRuntime.activeRole;
}

function setMiniOverlay(text) {
  if (!els.miniOverlay) return;
  els.miniOverlay.textContent = text || "";
  els.miniOverlay.classList.add("visible");
  window.setTimeout(() => els.miniOverlay?.classList.remove("visible"), 900);
}

function buildFullTextForItem(item) {
  if (!item) return "";
  return item.blocks.map((block) => block.text || "").join("\n\n");
}

async function readImportedText(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt")) return normalizeImportedText(await file.text());
  if (lower.endsWith(".docx")) return await readDocxText(file);
  throw new Error("Csak .txt és .docx támogatott.");
}

async function readDocxText(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("A DOCX-ben nincs document.xml");
  const xml = await entry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paragraphs = Array.from(doc.getElementsByTagNameNS(ns, "p"));
  const lines = paragraphs.map((p) =>
    Array.from(p.getElementsByTagNameNS(ns, "t"))
      .map((t) => t.textContent || "")
      .join("")
      .replace(/\u00a0/g, " ")
      .trimRight()
  );
  return normalizeImportedText(lines.join("\n"));
}

function normalizeImportedText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseShowlistText(text) {
  const lines = String(text || "").split("\n");
  const items = [];
  let pendingCombined = "";

  for (let i = 0; i < lines.length; i += 1) {
    let rawLine = cleanTitle(lines[i]);
    if (!rawLine || /^_+$/.test(rawLine)) continue;
    if (/műsorszámok/i.test(rawLine)) continue;

    if (pendingCombined) {
      rawLine = `${pendingCombined} ${rawLine}`;
      pendingCombined = "";
    }

    if (/^\d+\.\s*[^:]+:\s*$/.test(rawLine) || /:\s*$/.test(rawLine) && !/\d{1,2}:\d{2}/.test(rawLine)) {
      pendingCombined = rawLine;
      continue;
    }

    const combinedParsed = parseShowlistSongLine(rawLine);
    if (combinedParsed) {
      items.push(combinedParsed);
      continue;
    }

    if (/^k[oö]sz[oö]nt[eé]s$/i.test(rawLine)) {
      items.push({ type: "announcement", title: "Köszöntés", duration: "" });
      continue;
    }

    if (/^bejelent[eé]s\??/i.test(rawLine)) {
      const name = cleanTitle(rawLine.split(":").slice(1).join(":"));
      items.push({ type: "announcement", title: name || "Bejelentés", duration: "" });
    }
  }

  return items;
}

function parseShowlistSongLine(line) {
  const compact = cleanTitle(line).replace(/^\d+\.\s*/, "");
  const match = compact.match(/^(.*?)(\d{1,2}:\d{2})\s*$/);
  if (!match) return null;
  const beforeDuration = cleanTitle(match[1]);
  const duration = match[2];
  const title = cleanTitle(beforeDuration.split(":").pop());
  if (!title) return null;
  return { type: "song", title, duration };
}

function parseLyricsBookText(text) {
  const lines = String(text || "").split("\n").map((line) => line.trimRight());
  const songs = [];
  let startIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (!looksLikeSongHeading(lines[i])) continue;
    const lookahead = lines.slice(i + 1, Math.min(lines.length, i + 12));
    if (lookahead.some((line) => looksLikeRoleStarter(line))) {
      startIndex = i;
      break;
    }
  }
  if (startIndex < 0) return songs;

  let i = startIndex;
  while (i < lines.length) {
    if (!looksLikeSongHeading(lines[i])) {
      i += 1;
      continue;
    }

    const heading = cleanLine(lines[i]);
    i += 1;
    const body = [];
    while (i < lines.length && !looksLikeSongHeading(lines[i])) {
      body.push(lines[i]);
      i += 1;
    }

    const title = extractSongTitleFromHeading(heading);
    const rawText = normalizeImportedText(body.join("\n"));
    if (title) {
      songs.push({
        title,
        rawText,
        blocks: parseBlocksFromSongText(rawText),
      });
    }
  }

  return songs;
}

function looksLikeSongHeading(line) {
  return /^\d+\s*[.,]\s*/.test(cleanLine(line));
}

function extractSongTitleFromHeading(heading) {
  const clean = cleanTitle(heading).replace(/^\d+\s*[.,]?\s*/, "");
  return cleanTitle(clean.split(":").pop());
}

function parseBlocksFromSongText(text) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let currentRole = "";
  let currentLines = [];

  function pushBlock() {
    const joined = currentLines.join("\n").trim();
    if (!joined) return;
    blocks.push({ role: currentRole, text: joined });
  }

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) {
      if (currentLines.length) currentLines.push("");
      continue;
    }

    const split = splitRoleLine(rawLine);
    if (split) {
      pushBlock();
      currentRole = split.role;
      currentLines = [];
      if (split.text) currentLines.push(split.text);
      continue;
    }

    currentLines.push(line);
  }

  pushBlock();

  if (!blocks.length && text.trim()) {
    blocks.push({ role: "", text: text.trim() });
  }

  return blocks;
}

function splitRoleLine(rawLine) {
  const line = String(rawLine || "").replace(/\u00a0/g, " ").trim();
  const match = line.match(/^(.{1,35}?):\s*(.*)$/);
  if (!match) return null;
  const role = cleanTitle(match[1]);
  if (!looksLikeRoleLine(role)) return null;
  return { role, text: cleanTitle(match[2]) };
}

function looksLikeRoleStarter(line) {
  return /^\s*[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű0-9 +()./\-]{1,35}:/.test(String(line || "").replace(/\u00a0/g, " ").trim());
}

function looksLikeRoleLine(value) {
  const line = cleanTitle(value).replace(/\+$/g, "").trim();
  if (!line) return false;
  if (line.length > 35) return false;
  if (/^\d+$/.test(line)) return false;
  return /^[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű0-9 +()./\-]+$/.test(line);
}

function rebuildProjectFromSources() {
  if (!sources.showlistItems.length) {
    project.items = [];
    state.itemIndex = 0;
    state.blockIndex = 0;
    renderAll();
    return;
  }

  project.items = sources.showlistItems.map((showItem) => {
    if (showItem.type === "announcement") {
      return {
        title: showItem.title,
        duration: showItem.duration || "",
        type: "announcement",
        blocks: [{ role: "", text: `BEJELENTÉS\n\n${showItem.title}` }],
      };
    }

    const match = findBestLyricsMatch(showItem.title, sources.lyricSongs);
    if (match) {
      return {
        title: showItem.title,
        duration: showItem.duration || "",
        type: "song",
        blocks: match.blocks.length
          ? structuredClone(match.blocks)
          : [{ role: "", text: match.rawText || "" }],
      };
    }

    return {
      title: showItem.title,
      duration: showItem.duration || "",
      type: "song",
      blocks: [{ role: "", text: "Ehhez a dalhoz nem találtam szöveget a betöltött szövegkönyvben." }],
    };
  });

  state.itemIndex = 0;
  state.blockIndex = 0;
  state.isPlaying = false;
  state.black = false;
  renderAll();
  syncDisplay();
}

function findBestLyricsMatch(showTitle, lyricSongs) {
  const target = normalizeTitle(showTitle);
  let best = null;
  let bestScore = -1;

  for (const song of lyricSongs) {
    const source = normalizeTitle(song.title);
    if (!source) continue;
    let score = 0;
    if (source === target) {
      score = 100;
    } else if (source.includes(target) || target.includes(source)) {
      score = 90;
    } else {
      const targetTokens = target.split(" ").filter(Boolean);
      const sourceTokens = source.split(" ").filter(Boolean);
      const common = targetTokens.filter((token) => sourceTokens.includes(token)).length;
      score = Math.round((common / Math.max(targetTokens.length, sourceTokens.length, 1)) * 100);
    }
    if (score > bestScore) {
      bestScore = score;
      best = song;
    }
  }

  return bestScore >= 40 ? best : null;
}

function normalizeTitle(value) {
  const base = String(value || "")
    .replace(/…/g, "")
    .replace(/\.\.\.+/g, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliasMap = {
    "kicsi gyere velem rozsat szedni": "kicsi gyere velem",
    "akarsz e lekeveros": "akarsz e",
    "a zene az kell kozos": "a zene az kell",
    "orokre szepek ii": "orokre szepek",
    "a muzsika hangja duett doremi a muzsika hangja": "a muzsika hangja",
  };

  return aliasMap[base] || base;
}

function updateImportStatus(projectName = "") {
  if (!els.importStatus) return;

  const showText = sources.showlistFileName
    ? `${sources.showlistFileName} (${sources.showlistItems.length} tétel)`
    : "nincs betöltve";
  const lyricsText = sources.lyricsFileName
    ? `${sources.lyricsFileName} (${sources.lyricSongs.length} dal)`
    : "nincs betöltve";
  const projectText = projectName || uiPrefs.openedProjectFileName || "nincs megnyitva";

  els.importStatus.innerHTML = `
    Műsorrend: ${escapeHtml(showText)}<br>
    Szövegkönyv: ${escapeHtml(lyricsText)}<br>
    Projekt: ${escapeHtml(projectText)}<br>
    Mód: ${escapeHtml(getPlaybackModeLabel(project.playbackMode))}
  `;
}

function getPlaybackModeLabel(mode) {
  if (mode === "scroll-up") return "lentről felfelé";
  if (mode === "scroll-down") return "fentről lefelé";
  return "blokkonként";
}

async function saveProjectToFile() {
  const payload = {
    app: "EmlékSúgó",
    version: "2.5.0",
    savedAt: new Date().toISOString(),
    project: structuredClone(project),
    sources: structuredClone(sources),
    uiPrefs: structuredClone(uiPrefs),
    uiState: {
      itemIndex: state.itemIndex,
      blockIndex: state.blockIndex,
      speed: state.speed,
    },
  };

  const fileName = `emleksugo_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.esp`;
  const contents = JSON.stringify(payload, null, 2);

  try {
    const savedPath = await invoke("es_save_project_as", {
      defaultFilename: fileName,
      contents,
    });
    if (savedPath) {
      uiPrefs.openedProjectFileName = String(savedPath).split(/[\\/]/).pop() || fileName;
      updateImportStatus(uiPrefs.openedProjectFileName);
      await flashOverlay("Projekt mentve");
    }
    return;
  } catch (err) {
    console.warn("Natív projektmentés sikertelen, böngészős mentésre váltok:", err);
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  uiPrefs.openedProjectFileName = fileName;
  updateImportStatus(fileName);
}

function loadProjectFromObject(data) {
  project.title = data.project?.title || "EmlékSúgó";
  project.items = Array.isArray(data.project?.items) ? data.project.items : [];
  project.playbackMode = data.project?.playbackMode || "blocks";
  sources.showlistItems = Array.isArray(data.sources?.showlistItems) ? data.sources.showlistItems : [];
  sources.lyricSongs = Array.isArray(data.sources?.lyricSongs) ? data.sources.lyricSongs : [];
  sources.showlistFileName = data.sources?.showlistFileName || "";
  sources.lyricsFileName = data.sources?.lyricsFileName || "";
  uiPrefs.showListMain = typeof data.uiPrefs?.showListMain === "boolean" ? data.uiPrefs.showListMain : true;
  uiPrefs.showListDisplay = typeof data.uiPrefs?.showListDisplay === "boolean" ? data.uiPrefs.showListDisplay : false;
  uiPrefs.openedProjectFileName = data.uiPrefs?.openedProjectFileName || "";
  uiPrefs.textStyle = {
    ...DEFAULT_TEXT_STYLE,
    ...(data.uiPrefs?.textStyle || {}),
  };
  uiPrefs.roleStyle = {
    ...DEFAULT_ROLE_STYLE,
    ...(data.uiPrefs?.roleStyle || {}),
  };
  state.speed = clampNumber(data.uiState?.speed, 100, 0, 200);
  state.itemIndex = clampNumber(data.uiState?.itemIndex, 0, 0, Math.max(project.items.length - 1, 0));
  const item = getCurrentItem();
  state.blockIndex = clampNumber(data.uiState?.blockIndex, 0, 0, Math.max((item?.blocks?.length || 1) - 1, 0));
  state.isPlaying = false;
  state.black = false;
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cleanTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanLine(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
