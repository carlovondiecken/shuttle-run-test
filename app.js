const STORAGE_KEY = "shuttle20m.v1";
const SHUTTLE_LENGTH_M = 20;

const state = {
  teamName: "",
  testDate: today(),
  tester: "",
  players: [],
  results: [],
  running: false,
  startedAt: null,
  elapsedBeforePause: 0,
  tickTimer: null,
  audioContext: null,
};

const BIB_COLORS = ["blue", "red", "green", "yellow"];

const $ = (id) => document.getElementById(id);

const fields = {
  teamName: $("teamName"),
  testDate: $("testDate"),
  tester: $("tester"),
};

const protocol = buildProtocol(21);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function buildProtocol(maxLevel) {
  const stages = [];
  let elapsed = 0;
  let cumulativeShuttles = 0;
  for (let level = 1; level <= maxLevel; level++) {
    const speed = 8 + level * 0.5;
    const shuttleTime = (SHUTTLE_LENGTH_M / (speed * 1000)) * 3600;
    const shuttles = Math.max(1, Math.round(60 / shuttleTime));
    for (let shuttle = 1; shuttle <= shuttles; shuttle++) {
      stages.push({
        level,
        shuttle,
        speed,
        shuttleTime,
        start: elapsed,
        end: elapsed + shuttleTime,
        completedShuttles: cumulativeShuttles,
      });
      elapsed += shuttleTime;
      cumulativeShuttles += 1;
    }
  }
  return stages;
}

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.teamName = parsed.teamName ?? "";
    state.testDate = parsed.testDate ?? today();
    state.tester = parsed.tester ?? "";
    state.players = Array.isArray(parsed.players) ? parsed.players : [];
    state.results = Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    teamName: state.teamName,
    testDate: state.testDate,
    tester: state.tester,
    players: state.players,
    results: state.results,
  }));
}

function saveFields() {
  state.teamName = fields.teamName.value.trim();
  state.testDate = fields.testDate.value || today();
  state.tester = fields.tester.value.trim();
  saveStore();
}

function elapsedSeconds() {
  if (!state.startedAt) return state.elapsedBeforePause;
  return state.elapsedBeforePause + (Date.now() - state.startedAt) / 1000;
}

function currentStage(seconds = elapsedSeconds()) {
  return protocol.find((stage) => seconds >= stage.start && seconds < stage.end) ?? protocol[protocol.length - 1];
}

function completedShuttles(seconds = elapsedSeconds()) {
  const stage = currentStage(seconds);
  const partial = seconds >= stage.end ? 1 : 0;
  return stage.completedShuttles + partial;
}

function scoreAt(seconds = elapsedSeconds()) {
  const stage = currentStage(seconds);
  const shuttles = completedShuttles(seconds);
  const distance = shuttles * SHUTTLE_LENGTH_M;
  return {
    elapsed: seconds,
    level: stage.level,
    shuttle: stage.shuttle,
    speed: stage.speed,
    pace: paceFromSpeed(stage.speed),
    distance,
    vo2: estimateVo2(stage.speed),
    nextBeep: Math.max(0, stage.end - seconds),
    progress: Math.min(100, Math.max(0, ((seconds - stage.start) / stage.shuttleTime) * 100)),
  };
}

function estimateVo2(speedKmh) {
  return 6 * speedKmh - 24.4;
}

function paceFromSpeed(speedKmh) {
  if (!speedKmh) return "--";
  const totalSeconds = Math.round(3600 / speedKmh);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function addPlayer(name = "New player", bib = "", color = "") {
  const nextBib = bib || String(state.players.length + 1);
  const nextColor = color || BIB_COLORS[state.players.length % BIB_COLORS.length];
  const player = { id: uid("PLY"), name, bib: nextBib, color: nextColor, age: "" };
  state.players.push(player);
  saveStore();
  render();
}

function removePlayer(id) {
  state.players = state.players.filter((player) => player.id !== id);
  state.results = state.results.filter((result) => result.playerId !== id);
  saveStore();
  render();
}

function startTest() {
  if (!state.players.length) addPlayer();
  if (state.running) return;
  saveFields();
  state.running = true;
  state.startedAt = Date.now();
  startTicker();
}

function pauseTest() {
  if (!state.running) return;
  state.elapsedBeforePause = elapsedSeconds();
  state.startedAt = null;
  state.running = false;
  stopTicker();
  render();
}

function resetTest() {
  state.running = false;
  state.startedAt = null;
  state.elapsedBeforePause = 0;
  stopTicker();
  render();
}

function startTicker() {
  stopTicker();
  let lastShuttle = currentStage().completedShuttles;
  state.tickTimer = setInterval(() => {
    const stage = currentStage();
    if (stage.completedShuttles !== lastShuttle) {
      lastShuttle = stage.completedShuttles;
      playBeep();
    }
    renderClock();
  }, 100);
}

function stopTicker() {
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = null;
}

function playBeep() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audioContext = state.audioContext || new AudioContext();
  const context = state.audioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
}

function recordStop(playerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || state.results.some((result) => result.playerId === playerId)) return;
  const score = scoreAt();
  state.results.push({
    id: uid("RES"),
    playerId,
    name: player.name,
    bib: player.bib,
    color: player.color,
    age: player.age,
    teamName: state.teamName,
    testDate: state.testDate,
    tester: state.tester,
    ...score,
  });
  saveStore();
  render();
}

function clearResults() {
  state.results = [];
  saveStore();
  render();
}

function activePlayers() {
  const finished = new Set(state.results.map((result) => result.playerId));
  return state.players.filter((player) => !finished.has(player.id));
}

function renderFields() {
  fields.teamName.value = state.teamName;
  fields.testDate.value = state.testDate;
  fields.tester.value = state.tester;
}

function renderPlayers() {
  const list = $("playerList");
  list.innerHTML = "";
  state.players.forEach((player) => {
    const node = $("playerTemplate").content.firstElementChild.cloneNode(true);
    const bibInput = node.querySelector(".player-bib");
    const colorInput = node.querySelector(".player-color");
    const nameInput = node.querySelector(".player-name");
    const ageInput = node.querySelector(".player-age");
    bibInput.value = player.bib ?? "";
    colorInput.value = player.color ?? "blue";
    nameInput.value = player.name;
    ageInput.value = player.age;
    bibInput.addEventListener("input", () => {
      player.bib = bibInput.value;
      saveStore();
      renderLiveGrid();
      renderResults();
    });
    colorInput.addEventListener("input", () => {
      player.color = colorInput.value;
      saveStore();
      renderLiveGrid();
      renderResults();
    });
    nameInput.addEventListener("input", () => {
      player.name = nameInput.value.trim() || "Unnamed player";
      saveStore();
      renderLiveGrid();
      renderResults();
    });
    ageInput.addEventListener("input", () => {
      player.age = ageInput.value;
      saveStore();
    });
    node.querySelector(".remove-player").addEventListener("click", () => removePlayer(player.id));
    list.appendChild(node);
  });
}

function renderClock() {
  const score = scoreAt();
  $("elapsedTime").textContent = formatTime(score.elapsed);
  $("levelShuttle").textContent = `${score.level} / ${score.shuttle}`;
  $("currentDistance").textContent = `${score.distance} m`;
  $("currentSpeed").textContent = round(score.speed, 1);
  $("currentPace").textContent = score.pace;
  $("currentVo2").textContent = round(score.vo2, 1);
  $("nextBeep").textContent = round(score.nextBeep, 1);
  $("shuttleProgress").style.width = `${score.progress}%`;
}

function renderLiveGrid() {
  const grid = $("liveGrid");
  grid.innerHTML = "";
  const resultMap = new Map(state.results.map((result) => [result.playerId, result]));
  state.players.forEach((player) => {
    const result = resultMap.get(player.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `runner-card ${player.color || "blue"} ${result ? "finished" : "active"}`;
    button.disabled = Boolean(result);
    const bib = `<span class="bib-chip ${escapeHtml(player.color || "blue")}">#${escapeHtml(player.bib || "-")}</span>`;
    button.innerHTML = result
      ? `${bib}<strong>${escapeHtml(player.name)}</strong><span>Stopped at ${result.level}/${result.shuttle}</span><span>${result.distance} m - VO2 ${round(result.vo2, 1)}</span>`
      : `${bib}<strong>${escapeHtml(player.name)}</strong><span>Tap when stopped</span><span>${escapeHtml(player.age ? `${player.age} yrs` : "Age not set")}</span>`;
    button.addEventListener("click", () => recordStop(player.id));
    grid.appendChild(button);
  });
  $("activeCount").textContent = `${activePlayers().length} active`;
}

function renderResults() {
  const body = $("resultsBody");
  body.innerHTML = "";
  [...state.results]
    .sort((a, b) => b.distance - a.distance || b.speed - a.speed)
    .forEach((result, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td><span class="bib-chip ${escapeHtml(result.color || "blue")}">#${escapeHtml(result.bib || "-")}</span></td>
        <td>${escapeHtml(result.name)}</td>
        <td>${result.level}/${result.shuttle}</td>
        <td>${result.distance} m</td>
        <td>${round(result.speed, 1)} km/h</td>
        <td>${result.pace}</td>
        <td>${round(result.vo2, 1)}</td>
        <td>${formatTime(result.elapsed)}</td>
      `;
      body.appendChild(row);
    });
}

function renderControls() {
  $("startBtn").disabled = state.running;
  $("pauseBtn").disabled = !state.running;
}

function render() {
  renderFields();
  renderPlayers();
  renderClock();
  renderLiveGrid();
  renderResults();
  renderControls();
}

function exportData() {
  const blob = new Blob([JSON.stringify({
    teamName: state.teamName,
    testDate: state.testDate,
    tester: state.tester,
    players: state.players,
    results: state.results,
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `20m-shuttle-${state.testDate || today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      state.teamName = parsed.teamName ?? "";
      state.testDate = parsed.testDate ?? today();
      state.tester = parsed.tester ?? "";
      state.players = Array.isArray(parsed.players) ? parsed.players : [];
      state.results = Array.isArray(parsed.results) ? parsed.results : [];
      saveStore();
      render();
    } catch (error) {
      alert(`Could not import data: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

$("addPlayerBtn").addEventListener("click", () => addPlayer());
$("quickAddBtn").addEventListener("click", () => {
  const input = $("playerNameInput");
  addPlayer(input.value.trim() || "New player");
  input.value = "";
  input.focus();
});
$("playerNameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("quickAddBtn").click();
});
$("startBtn").addEventListener("click", startTest);
$("pauseBtn").addEventListener("click", pauseTest);
$("resetBtn").addEventListener("click", resetTest);
$("beepBtn").addEventListener("click", playBeep);
$("clearResultsBtn").addEventListener("click", clearResults);
$("exportBtn").addEventListener("click", exportData);
$("importInput").addEventListener("change", (event) => event.target.files[0] && importData(event.target.files[0]));
Object.values(fields).forEach((field) => field.addEventListener("input", saveFields));

loadStore();
if (!state.players.length) {
  BIB_COLORS.forEach((color) => {
    for (let bib = 1; bib <= 5; bib++) {
      addPlayer(`${capitalize(color)} ${bib}`, String(bib), color);
    }
  });
} else {
  render();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
