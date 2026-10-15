import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const AGES = ["Baby", "Toddler", "3–5", "6–8", "9–12"];
const TAGS = ["Favorite", "Bedtime", "New", "Outgrown"];
const PLANS = ["Undecided", "Donate", "Sell", "Save for a sibling", "Give to family"];
const ANIMALS = ["fox", "owl", "bunny", "bear", "deer", "hedgehog"];
const KIDCOLORS = ["#d9783f", "#8a6a9e", "#c99a6b", "#7a5a3a", "#b5653a", "#5e9a4a", "#4f8a8b", "#c0473a"];
const JEWELS = ["#2c4a2e", "#5a2a24", "#1f4a4a", "#4b3a1c", "#3d2a4a", "#24533f", "#6a3a22", "#2f3f22"];
const TOYCOLORS = ["#c0473a", "#4f8a8b", "#5e9a4a", "#d39a32", "#8a6a9e", "#b5653a"];

const EXAMPLES = {
  name: "Our Little Library",
  savedAt: 0,
  kids: [],
  items: [
    { id: "ex1", kind: "book", list: "own", title: "The Very Hungry Caterpillar", author: "Eric Carle", isbn: "9780399226908", ages: "Toddler", tags: ["Favorite"], example: true },
    { id: "ex2", kind: "book", list: "own", title: "Goodnight Moon", author: "Margaret Wise Brown", isbn: "9780064430173", ages: "Baby", tags: ["Bedtime"], example: true },
    { id: "ex3", kind: "book", list: "own", title: "Where the Wild Things Are", author: "Maurice Sendak", isbn: "9780060254926", ages: "3–5", tags: ["Favorite", "Bedtime"], example: true },
    { id: "ex4", kind: "book", list: "own", title: "The Gruffalo", author: "Julia Donaldson", isbn: "9780142403877", ages: "3–5", tags: [], example: true },
    { id: "ex5", kind: "book", list: "own", title: "Corduroy", author: "Don Freeman", isbn: "9780140501735", ages: "3–5", tags: ["Outgrown"], example: true },
    { id: "ex6", kind: "toy", list: "own", title: "Wooden rainbow stacker", ages: "Toddler", tags: ["Favorite"], example: true },
    { id: "ex7", kind: "toy", list: "own", title: "Magnetic building tiles", ages: "3–5", tags: ["New"], example: true },
    { id: "ex8", kind: "toy", list: "own", title: "Plush bunny", ages: "Baby", tags: ["Bedtime"], example: true },
    { id: "ex12", kind: "toy", list: "own", title: "Wooden train set", ages: "3–5", tags: [], stored: true, example: true },
    { id: "ex9", kind: "book", list: "wish", title: "Room on the Broom", author: "Julia Donaldson", isbn: "9780142501122", ages: "3–5", tags: [], note: "Hardcover if possible", example: true },
    { id: "ex10", kind: "toy", list: "wish", title: "Balance bike", ages: "3–5", tags: [], note: "Blue or green, 12 inch wheels", example: true },
    { id: "ex11", kind: "toy", list: "wish", title: "Toy kitchen play food set", ages: "Toddler", tags: [], example: true },
    { id: "ex13", kind: "toy", list: "pass", passPlan: "Donate", title: "Baby activity gym", ages: "Baby", tags: ["Outgrown"], example: true }
  ]
};

/* ---------- state ---------- */
const S = {
  lib: null, tab: "books", q: "", age: "", tag: "", kid: "",
  canEdit: false, session: null, loadErr: "",
  claims: {}, showClaimers: false, saving: "", saveErr: "",
  modal: null, claimOpen: null, rotateMsg: "", myName: ""
};
const TABS = ["books", "toys", "wishlist", "pass"];
try { S.myName = localStorage.getItem("fl-name") || ""; } catch (e) {}
try { const t = localStorage.getItem("ss-tab"); if (TABS.includes(t)) S.tab = t; const k = localStorage.getItem("ss-kid"); if (k) S.kid = k; } catch (e) {}
const h = location.hash.replace("#", "");
if (TABS.includes(h)) S.tab = h;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hash = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const dayKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const niceDate = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

/* ---------- loading ---------- */
async function load() {
  const { data, error } = await sb.from("library").select("data").eq("id", 1).maybeSingle();
  if (error) {
    // No signal: fall back to the copy saved on this phone the last time it loaded.
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("fl-library") || "null"); } catch (_) {}
    S.offline = true;
    S.loadErr = saved ? "No connection right now, so this is the copy saved on this phone. Changes can't be saved until you're back online." : "The library couldn't be reached just now. Try reloading in a moment.";
    S.lib = S.lib || saved || JSON.parse(JSON.stringify(EXAMPLES));
  } else {
    S.offline = false; S.loadErr = ""; S.lib = (data && data.data) || JSON.parse(JSON.stringify(EXAMPLES));
    try { localStorage.setItem("fl-library", JSON.stringify(S.lib)); } catch (_) {}
  }
  if (!Array.isArray(S.lib.items)) S.lib.items = [];
  if (!Array.isArray(S.lib.kids)) S.lib.kids = [];
  if (S.kid && (!multiKids() || !S.lib.kids.some((k) => k.name === S.kid))) S.kid = "";
}

/* ---------- saving ---------- */
let saveTimer = null;
function changed() {
  S.lib.savedAt = Date.now();
  S.saving = "Saving…"; S.saveErr = "";
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 900);
}
async function save() {
  if (!S.canEdit) { S.saving = ""; S.saveErr = "Sign in to save changes"; render(); return; }
  const { error } = await sb.from("library").upsert({ id: 1, data: S.lib, updated_at: new Date().toISOString() });
  if (error) {
    S.saving = "";
    S.saveErr = "Couldn't save just now. Your change is still on this screen; try again in a moment.";
    render();
    return;
  }
  try { localStorage.setItem("fl-library", JSON.stringify(S.lib)); } catch (_) {}
  S.saving = "Saved"; render();
  setTimeout(() => { if (S.saving === "Saved") { S.saving = ""; render(); } }, 2500);
}

/* ---------- wishlist claims ---------- */
// Each browser gets a random token so the person who claimed a gift can undo it without an account.
function claimToken() {
  let t = "";
  try { t = localStorage.getItem("fl-claim-token") || ""; } catch (_) {}
  if (t.length < 16) {
    t = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem("fl-claim-token", t); } catch (_) {}
  }
  return t;
}
async function loadClaims() {
  const { data, error } = await sb.rpc("list_claims", { p_token: claimToken() });
  if (error) return;
  const c = {};
  for (const r of data || []) c[r.item_id] = { name: r.name, mine: r.mine, at: r.created_at };
  S.claims = c;
  render();
}
/* ---------- kids ---------- */
const kidByName = (n) => S.lib.kids.find((k) => k.name === n);
// With one child (or none) the child picker and per-child options stay hidden.
const multiKids = () => S.lib.kids.length > 1;
function kidAgeGroup(kid) {
  if (!kid || !kid.birthday) return "";
  const [y, m, d] = kid.birthday.split("-").map(Number);
  const months = (Date.now() - new Date(y, m - 1, d)) / 2629800000;
  return months < 12 ? "Baby" : months < 36 ? "Toddler" : months < 72 ? "3–5" : months < 108 ? "6–8" : "9–12";
}
function kidAgeText(kid) {
  if (!kid || !kid.birthday) return "";
  const [y, m, d] = kid.birthday.split("-").map(Number);
  const months = Math.floor((Date.now() - new Date(y, m - 1, d)) / 2629800000);
  if (months < 0) return "";
  return months < 24 ? months + " months" : Math.floor(months / 12) + " years";
}
function animalSvg(animal, color, size = 34) {
  const face = `<circle cx="20" cy="22" r="13" fill="${esc(color)}"/>`;
  const eyes = `<circle cx="15.5" cy="21" r="1.8" fill="#1d1a14"/><circle cx="24.5" cy="21" r="1.8" fill="#1d1a14"/>`;
  const nose = `<ellipse cx="20" cy="26" rx="2" ry="1.4" fill="#1d1a14"/>`;
  let back = "", front = "";
  switch (animal) {
    case "fox": back = `<path d="M8 6l9 9-8 4z M32 6l-9 9 8 4z" fill="${esc(color)}"/>`; front = `<path d="M8 24c4 7 8 9 12 9s8-2 12-9c-4 2-8 1-12 1s-8 1-12-1z" fill="#fff6e6"/>`; break;
    case "owl": back = `<path d="M8 8l6 8-7 2z M32 8l-6 8 7 2z" fill="${esc(color)}"/>`; front = `<circle cx="15" cy="21" r="5" fill="#fff6e6"/><circle cx="25" cy="21" r="5" fill="#fff6e6"/><path d="M18 26l2 3 2-3z" fill="#e2a93f"/>`; break;
    case "bunny": back = `<ellipse cx="14" cy="7" rx="3.5" ry="9" fill="${esc(color)}"/><ellipse cx="26" cy="7" rx="3.5" ry="9" fill="${esc(color)}"/><ellipse cx="14" cy="8" rx="1.5" ry="6" fill="#f3c6c6"/><ellipse cx="26" cy="8" rx="1.5" ry="6" fill="#f3c6c6"/>`; break;
    case "bear": back = `<circle cx="9.5" cy="11" r="5" fill="${esc(color)}"/><circle cx="30.5" cy="11" r="5" fill="${esc(color)}"/>`; front = `<ellipse cx="20" cy="27" rx="5.5" ry="4" fill="#efe1c8"/>`; break;
    case "deer": back = `<path d="M13 11l-5-8M10 6l-4 1M27 11l5-8M30 6l4 1" stroke="#7a5a3a" stroke-width="2" stroke-linecap="round" fill="none"/><ellipse cx="7" cy="15" rx="4.5" ry="2.5" fill="${esc(color)}"/><ellipse cx="33" cy="15" rx="4.5" ry="2.5" fill="${esc(color)}"/>`; front = `<circle cx="14" cy="15" r="1" fill="#fff6e6"/><circle cx="26" cy="15" r="1" fill="#fff6e6"/>`; break;
    case "hedgehog": back = `<path d="M5 22l-2-7 6 2-1-8 6 4 1-8 5 6 5-6 1 8 6-4-1 8 6-2-2 7z" fill="#6a4a2a"/>`; front = `<ellipse cx="20" cy="26" rx="8" ry="6" fill="#f2e2c6"/>`; break;
  }
  const fullEyes = animal === "owl" ? `<circle cx="15" cy="21" r="2" fill="#1d1a14"/><circle cx="25" cy="21" r="2" fill="#1d1a14"/>` : eyes;
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${back}${face}${front}${fullEyes}${animal === "owl" ? "" : nose}</svg>`;
}

/* ---------- reading log ---------- */
function readsFor(kidName) {
  const out = [];
  for (const it of S.lib.items) if (it.kind === "book") for (const r of it.reads || []) if (!kidName || r.k === kidName) out.push({ ...r, it });
  return out;
}
function streak(reads) {
  const days = new Set(reads.map((r) => r.d));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function logRead(it, kidName) {
  it.reads = it.reads || [];
  it.reads.push({ d: today(), k: kidName || "" });
  changed();
}

/* ---------- views ---------- */
function matchesKid(it) { return !S.kid || !it.forKid || it.forKid === S.kid; }
function filtered(kind, list, extra) {
  const q = S.q.trim().toLowerCase();
  return S.lib.items.filter((it) =>
    (kind ? it.kind === kind : true) && it.list === list && matchesKid(it) && (!extra || extra(it)) &&
    (!S.age || it.ages === S.age) && (!S.tag || (it.tags || []).includes(S.tag)) &&
    (!q || [it.title, it.author, it.note, it.forKid, it.passPlan, ...(it.tags || [])].join(" ").toLowerCase().includes(q))
  ).sort((a, b) => (b.tags || []).includes("Favorite") - (a.tags || []).includes("Favorite") || String(a.title).localeCompare(String(b.title)));
}
const count = (kind, list) => S.lib.items.filter((i) => (kind ? i.kind === kind : true) && i.list === list && matchesKid(i)).length;

const leafSvg = (s = 22, c = "#f0dd8c") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M20 3C11 3 4 8 4 15c0 2 .6 3.6 1.4 4.8L3 22l1.4 1.4 2.4-2.4C8 21.6 9.6 22 11 22c7 0 10-8 9-19zM8 18c2-4 5-7 9-9-3 3-5.5 6-7.5 9.6z"/></svg>`;
const starSvg = (s = 22, c = "#f0dd8c") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M12 1.5l2.6 7 7.4.3-5.8 4.6 2 7.1L12 16.4 5.8 20.5l2-7.1L2 8.8l7.4-.3z"/></svg>`;
function madeCover(it) {
  const bg = JEWELS[hash(it.title) % JEWELS.length];
  return `<div class="made" style="background:radial-gradient(120% 70% at 50% 0%, rgb(255 255 255 / .14), transparent 60%), ${bg}">
    ${leafSvg(20)}<span class="t">${esc(it.title)}</span><span class="a">${esc(it.author || "")}</span></div>`;
}
function bookArt(it) { return it.photo ? `<img src="${esc(it.photo)}" alt="">` : madeCover(it); }
function toyBlock(it) {
  const c = TOYCOLORS[hash(it.title) % TOYCOLORS.length];
  const letter = (String(it.title).trim()[0] || "?").toUpperCase();
  return `<div class="ph" style="background:${c}">${it.photo ? `<img src="${esc(it.photo)}" alt="">` : `<span class="block">${esc(letter)}</span>`}</div>`;
}
function tagsHtml(it) {
  const t = (it.tags || []).map((x) => `<span class="tag${x === "Favorite" ? " fav" : ""}">${esc(x)}</span>`);
  if (it.ages) t.unshift(`<span class="tag">Ages ${esc(it.ages)}</span>`);
  if (it.forKid && multiKids()) t.push(`<span class="tag">For ${esc(it.forKid)}</span>`);
  if (it.reads && it.reads.length) t.push(`<span class="tag reads">Read ${it.reads.length}×</span>`);
  if (it.example) t.push(`<span class="tag ex">Example</span>`);
  return `<div class="meta">${t.join("")}</div>`;
}
function filtersHtml(placeholder, withTags = true) {
  return `<div class="filters">
    <input class="search" id="q" type="search" placeholder="${esc(placeholder)}" value="${esc(S.q)}" aria-label="Search">
    ${AGES.map((a) => `<button class="chip" data-age="${esc(a)}" aria-pressed="${S.age === a}">${esc(a)}</button>`).join("")}
    ${withTags ? TAGS.map((t) => `<button class="chip" data-tag="${esc(t)}" aria-pressed="${S.tag === t}">${esc(t)}</button>`).join("") : ""}
  </div>`;
}
function examplesNotice() {
  if (!S.canEdit || !S.lib.items.some((i) => i.example)) return "";
  return `<div class="notice"><span>The items marked <b>Example</b> are placeholders so you can see how things look. Add your own, then clear these out.</span>
    <button class="btn small" data-act="clear-examples">Clear examples</button></div>`;
}
function outgrownNotice(kind) {
  if (!S.canEdit) return "";
  const n = S.lib.items.filter((i) => i.kind === kind && i.list === "own" && (i.tags || []).includes("Outgrown")).length;
  if (!n) return "";
  return `<div class="notice"><span>${n} ${kind === "book" ? (n === 1 ? "book is" : "books are") : (n === 1 ? "toy is" : "toys are")} tagged Outgrown. Want to move ${n === 1 ? "it" : "them"} to the pass-along box?</span>
    <button class="btn small" data-act="move-outgrown" data-kind="${kind}">Move to pass-along</button></div>`;
}
function kidBar() {
  if (!multiKids()) return "";
  const sel = kidByName(S.kid);
  return `<div class="kidbar" role="group" aria-label="Show items for">
    <button class="kid" data-kid="" aria-pressed="${!S.kid}"><span class="kid-all">${leafSvg(18, "currentColor")}</span>Everyone</button>
    ${S.lib.kids.map((k) => `<button class="kid" data-kid="${esc(k.name)}" aria-pressed="${S.kid === k.name}">${animalSvg(k.animal, k.color, 30)}<span>${esc(k.name)}${kidAgeText(k) ? `<small>${esc(kidAgeText(k))}</small>` : ""}</span></button>`).join("")}
    ${S.canEdit ? `<button class="btn small ghost" data-act="add-kid">Add a child</button>${sel ? `<button class="btn small ghost" data-act="edit-kid">Edit ${esc(sel.name)}</button>` : ""}` : ""}
  </div>`;
}

function readingLog() {
  const reads = readsFor(S.kid);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
  const wk = dayKey(weekAgo);
  const week = reads.filter((r) => r.d >= wk).length;
  const st = streak(reads);
  const tally = {};
  for (const r of reads) tally[r.it.id] = (tally[r.it.id] || 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ it: S.lib.items.find((i) => i.id === id), n })).filter((x) => x.it);
  const who = S.kid ? S.kid + "'s" : multiKids() ? "Family" : "";
  const last = reads.slice().sort((a, b) => (a.d < b.d ? 1 : -1))[0];
  return `<div class="log" aria-label="${esc(who)} reading log">
    <div class="log-h"><span class="lbl">${who ? esc(who) + " reading log" : "Reading log"}</span>${last ? `<span class="hint-n">Last read: ${esc(last.it.title)}, ${esc(niceDate(last.d))}</span>` : ""}</div>
    <div class="log-stats">
      <div><b>${st}</b><span>${st === 1 ? "night" : "nights"} in a row</span></div>
      <div><b>${week}</b><span>${week === 1 ? "story" : "stories"} this week</span></div>
      <div><b>${reads.length}</b><span>${reads.length === 1 ? "story" : "stories"} read in all</span></div>
    </div>
    ${top.length ? `<div class="loved"><span class="lbl">Most loved</span>${top.map((x) => `<button class="loved-b" data-open="${esc(x.it.id)}"><span class="mini">${bookArt(x.it)}</span><span>${esc(x.it.title)}<small>${x.n} ${x.n === 1 ? "read" : "reads"}</small></span></button>`).join("")}</div>` :
      `<p class="hint-n">${S.canEdit ? "Open a book and tap “We read this tonight” to start the log." : "No stories logged yet."}</p>`}
  </div>`;
}

function booksView() {
  const items = filtered("book", "own");
  return `<section class="night" aria-label="Books">
    <svg class="treeline" viewBox="0 0 1200 230" preserveAspectRatio="none" aria-hidden="true"><path fill="#0a1d13" opacity=".85" d="M0 0h1200v40l-30 60-25-45-20 70-35-80-30 50-25-70-40 110-30-90-25 40-30-60-35 120-30-100-20 50-35-70-30 90-25-60-40 80-30-110-25 60-30-40-35 100-25-80-30 50-40-90-25 70-30-50-35 110-30-70-25 40-35-80-30 60-25-50-40 100-30-60-30 50-25-70-20 40V0z"/></svg>
    <canvas class="stars" aria-hidden="true"></canvas>
    <div class="inner">
      <div class="hero">
        <div>
          <p class="eyebrow">Deep in the whispering woods…</p>
          <h2>The Story Grove</h2>
          <p class="sub">${count("book", "own")} ${count("book", "own") === 1 ? "book" : "books"} in the grove${S.kid ? " for " + esc(S.kid) : ""}. Tap a cover to open it.</p>
          <div class="hero-acts"><button class="btn gold" data-act="pick-story">Pick tonight's story</button>
          ${S.canEdit ? `<button class="btn" data-act="add" data-kind="book" data-list="own">Add a book</button>` : ""}</div>
        </div>
        <svg class="moon" viewBox="0 0 100 100" aria-hidden="true">
          <defs><radialGradient id="mg" cx="40%" cy="35%"><stop offset="0" stop-color="#fdfbe6"/><stop offset="1" stop-color="#e9e39a"/></radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="4"/></filter></defs>
          <circle cx="50" cy="50" r="34" fill="#e4e98f" opacity=".35" filter="url(#glow)"/>
          <path d="M62 16a34 34 0 1 0 22 50A27 27 0 1 1 62 16z" fill="url(#mg)"/>
        </svg>
      </div>
      ${readingLog()}
      ${filtersHtml("Search books, authors, tags")}
      ${examplesNotice()}
      ${outgrownNotice("book")}
      ${items.length ? `<div class="shelf">${items.map((it) => `
        <button class="book" data-open="${esc(it.id)}">
          <div class="cover">${bookArt(it)}</div>
          <span class="bt">${esc(it.title)}</span>
          ${it.author ? `<span class="ba">${esc(it.author)}</span>` : ""}
          ${tagsHtml(it)}
        </button>`).join("")}</div>` :
        `<div class="empty">${S.q || S.age || S.tag ? "No books match that search." : "The grove is waiting for its first story."}</div>`}
    </div>
  </section>`;
}
function toyCard(it) { return `<button class="toy" data-open="${esc(it.id)}">${toyBlock(it)}<span class="tt">${esc(it.title)}</span>${tagsHtml(it)}</button>`; }
function toysView() {
  const out = filtered("toy", "own", (i) => !i.stored);
  const away = filtered("toy", "own", (i) => i.stored);
  const last = S.lib.lastRotation ? Math.floor((Date.now() - S.lib.lastRotation) / 86400000) : null;
  return `<section class="play" aria-label="Toys">
    <div class="bunting" aria-hidden="true"></div>
    <div class="inner">
      <h2>The Toy Clearing</h2>
      <p class="sub">${out.length} out to play, ${away.length} resting in the hollow.${last != null ? ` Last rotated ${last === 0 ? "today" : last === 1 ? "yesterday" : last + " days ago"}.` : ""}</p>
      ${filtersHtml("Search toys")}
      ${examplesNotice()}
      ${outgrownNotice("toy")}
      ${S.rotateMsg ? `<div class="notice"><span>${S.rotateMsg}</span><button class="btn small ghost" data-act="dismiss-rotate">OK</button></div>` : ""}
      ${S.canEdit ? `<div class="row-acts"><button class="btn primary" data-act="add" data-kind="toy" data-list="own">Add a toy</button>
        <button class="btn" data-act="rotate" ${away.length ? "" : "disabled title=\"Put some toys away first\""}>Rotate toys</button></div>` : ""}
      <h3 class="group">Out to play</h3>
      ${out.length ? `<div class="toybox">${out.map(toyCard).join("")}</div>` :
        `<div class="empty">${S.q || S.age || S.tag ? "No toys match that search." : "The clearing is empty for now."}</div>`}
      <h3 class="group">Resting in the hollow</h3>
      <p class="sub small">Toys put away for a while. Rotating swaps some of these back out so old toys feel new again.</p>
      ${away.length ? `<div class="toybox resting">${away.map(toyCard).join("")}</div>` : `<div class="empty">Nothing is put away. Open a toy and tap “Put away” to start a rotation.</div>`}
    </div>
  </section>`;
}
function rotateToys() {
  const kidOk = (i) => i.kind === "toy" && i.list === "own" && matchesKid(i);
  const out = S.lib.items.filter((i) => kidOk(i) && !i.stored && !(i.tags || []).includes("Favorite"));
  const away = S.lib.items.filter((i) => kidOk(i) && i.stored);
  const n = Math.min(away.length, Math.max(1, Math.round((out.length + away.length) / 4)));
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const bringOut = shuffle(away).slice(0, n);
  const putAway = shuffle(out).slice(0, Math.min(out.length, n));
  bringOut.forEach((i) => { i.stored = false; });
  putAway.forEach((i) => { i.stored = true; });
  S.lib.lastRotation = Date.now();
  S.rotateMsg = `Brought out: <b>${bringOut.map((i) => esc(i.title)).join(", ")}</b>.` + (putAway.length ? ` Put away: <b>${putAway.map((i) => esc(i.title)).join(", ")}</b>.` : "") + " Favorites always stay out.";
  changed();
}
function claimHtml(it) {
  const c = S.claims[it.id];
  if (c) {
    const mine = c.mine;
    let who = "";
    if (!S.canEdit || S.showClaimers || mine) who = mine ? "you" : (c.name || "someone");
    return `<span class="claimed">${starSvg(14, "currentColor")} ${who ? "Claimed by " + esc(who) : "Someone's getting this"}</span>
      ${mine ? `<button class="btn small ghost" data-unclaim="${esc(it.id)}">Undo</button>` : ""}`;
  }
  if (S.canEdit) return `<span class="hint">Not claimed yet</span>`;
  if (S.claimOpen === it.id) {
    return `<form class="claimform" data-claimform="${esc(it.id)}">
      <input id="claim-name-${esc(it.id)}" name="who" required maxlength="40" placeholder="Your name, like Aunt Jo" value="${esc(S.myName || "")}" aria-label="Your name">
      <button class="btn small primary" type="submit">Claim it</button>
      <button class="btn small ghost" type="button" data-act="claim-cancel">Cancel</button></form>`;
  }
  return `<button class="btn small primary" data-claim="${esc(it.id)}">I'll get this</button>`;
}
function isAmazon(url) { try { return /(^|\.)amazon\.|(^|\.)amzn\.(to|com)$|^a\.co$/i.test(new URL(url).hostname); } catch (e) { return false; } }
function amazonSearch(it) { return "https://www.amazon.com/s?k=" + encodeURIComponent([it.title, it.author].filter(Boolean).join(" ")) + (it.kind === "book" ? "&i=stripbooks" : "&i=toys-and-games"); }
function shopLinks(it) {
  if (it.link) return `<a class="shop${isAmazon(it.link) ? " amz" : ""}" href="${esc(it.link)}" target="_blank" rel="noopener">${isAmazon(it.link) ? "View on Amazon" : "Where to buy"}</a>`;
  return `<a class="shop amz" href="${esc(amazonSearch(it))}" target="_blank" rel="noopener">Find on Amazon</a>`;
}
function wishView() {
  const items = filtered(null, "wish");
  const claimedCount = items.filter((i) => S.claims[i.id]).length;
  return `<section class="wish" aria-label="Wishlist">
    <h2>The Wishing Well</h2>
    <p class="sub">${S.canEdit ? "Family and friends can tap “I'll get this” so nobody buys the same gift twice. Names stay hidden here unless you choose to look." : "Planning a gift? Tap “I'll get this” so nobody else buys the same thing."}</p>
    ${filtersHtml("Search the wish list", false)}
    ${examplesNotice()}
    <div class="row-acts">
      ${S.canEdit ? `<button class="btn primary" data-act="add" data-kind="toy" data-list="wish">Wish for a toy</button>
      <button class="btn gold" data-act="add" data-kind="book" data-list="wish">Wish for a book</button>
      ${claimedCount ? `<button class="btn ghost small" data-act="toggle-claimers">${S.showClaimers ? "Hide who's buying" : "Peek at who's buying"}</button>` : ""}` : ""}
    </div>
    ${items.length ? `<div class="giftlist">${items.map((it) => `
      <article class="gift${S.claims[it.id] ? " is-claimed" : ""}">
        <span class="ribbon" aria-hidden="true"></span>
        <button class="ph" style="border:0;padding:0;background:${it.kind === "book" ? JEWELS[hash(it.title) % JEWELS.length] : TOYCOLORS[hash(it.title) % TOYCOLORS.length]}" data-open="${esc(it.id)}" aria-label="Open ${esc(it.title)}">
          ${it.photo ? `<img src="${esc(it.photo)}" alt="">` : it.kind === "book" ? leafSvg(30) : `<span class="block" style="font-family:var(--f-play);font-size:2rem;color:#fff">${esc((String(it.title).trim()[0] || "?").toUpperCase())}</span>`}
        </button>
        <div class="body">
          <span class="gt">${esc(it.title)}${it.author ? ` <span class="hint">by ${esc(it.author)}</span>` : ""}</span>
          ${it.note ? `<span class="note">${esc(it.note)}</span>` : ""}
          ${tagsHtml(it)}
          <div class="acts">${claimHtml(it)}${shopLinks(it)}
            ${S.canEdit ? `<button class="btn small" data-got="${esc(it.id)}">We got it</button>` : ""}</div>
        </div>
      </article>`).join("")}</div>` :
      `<div class="empty">${S.q || S.age ? "Nothing in the well matches that." : "No wishes in the well yet."}</div>`}
  </section>`;
}
function passView() {
  const items = filtered(null, "pass");
  const groups = PLANS.map((p) => [p, items.filter((i) => (i.passPlan || "Undecided") === p)]).filter(([, a]) => a.length);
  return `<section class="pass" aria-label="Pass-along box">
    <h2>The Pass-Along Box</h2>
    <p class="sub">Outgrown books and toys waiting for their next home. ${S.canEdit ? "Open one to choose whether to donate, sell or save it." : "Ask if you'd like one for your little ones."}</p>
    ${filtersHtml("Search the pass-along box", false)}
    ${examplesNotice()}
    ${groups.length ? groups.map(([p, arr]) => `<h3 class="group">${esc(p)} <span class="n">${arr.length}</span></h3>
      <div class="passlist">${arr.map((it) => `<button class="passitem" data-open="${esc(it.id)}">
        <span class="mini${it.kind === "toy" ? " sq" : ""}">${it.kind === "book" ? bookArt(it) : toyBlock(it)}</span>
        <span class="pi-body"><span class="pi-t">${esc(it.title)}</span><span class="hint">${it.kind === "book" ? "Book" : "Toy"}${it.ages ? " · ages " + esc(it.ages) : ""}${it.forKid && multiKids() ? " · was " + esc(it.forKid) + "'s" : ""}</span></span>
      </button>`).join("")}</div>`).join("") :
      `<div class="empty">The box is empty. When something is outgrown, open it and tap “Move to pass-along”.</div>`}
  </section>`;
}

function detailSheet(m) {
  const it = m.item;
  const book = it.kind === "book";
  const art = book ? bookArt(it) : toyBlock(it).replace('class="ph"', 'class="ph" style="width:100%;height:100%"');
  const reads = (it.reads || []).slice().sort((a, b) => (a.d < b.d ? 1 : -1));
  const listName = it.list === "wish" ? " wish" : it.list === "pass" ? " in the pass-along box" : "";
  let acts = "";
  if (S.canEdit) {
    const a = [`<button class="btn" data-edit="${esc(it.id)}">Edit</button>`];
    if (it.list === "own") {
      if (!book) a.push(`<button class="btn" data-act="toggle-store">${it.stored ? "Bring out to play" : "Put away"}</button>`);
      a.push(`<button class="btn" data-act="pass-pick">Move to pass-along</button>`);
    }
    if (it.list === "pass") a.push(`<button class="btn" data-act="pass-back">Bring it back</button>`, `<button class="btn ghost" data-act="${m.confirmDel ? "del-yes" : "del-detail"}">${m.confirmDel ? "Yes, it's gone" : "It's gone, remove it"}</button>`);
    acts = `<div class="foot">${a.join("")}</div>`;
    if (m.passPick || it.list === "pass") acts += `<div class="field"><span class="lbl">What's the plan?</span><div class="seg">${PLANS.map((p) => `<button class="chip" data-plan="${esc(p)}" aria-pressed="${it.list === "pass" && (it.passPlan || "Undecided") === p}">${esc(p)}</button>`).join("")}</div></div>`;
  }
  let readBox = "";
  if (book && it.list === "own") {
    const kids = S.lib.kids;
    readBox = `<div class="readbox">
      ${S.canEdit ? `<div class="field">${multiKids() ? `<span class="lbl">We read this tonight</span>` : ""}<div class="seg">${multiKids() ? kids.map((k) => `<button class="chip kidchip" data-read="${esc(k.name)}">${animalSvg(k.animal, k.color, 20)} ${esc(k.name)}</button>`).join("") + `<button class="chip" data-read="">Together</button>` : `<button class="btn gold" data-read="">We read this tonight</button>`}</div></div>` : ""}
      ${m.justRead ? `<p class="claimed">${leafSvg(14, "currentColor")} Logged for tonight.</p>` : ""}
      ${reads.length ? `<p class="hint">Read ${reads.length} ${reads.length === 1 ? "time" : "times"}. Last on ${esc(niceDate(reads[0].d))}${reads[0].k ? " with " + esc(reads[0].k) : ""}.</p>` : `<p class="hint">Not in the reading log yet.</p>`}
    </div>`;
  }
  return `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dt">
    <header><h3 id="dt">${book ? "Book" : "Toy"}${listName}${it.stored ? " (put away)" : ""}</h3><button class="btn small ghost" data-act="close" aria-label="Close">Close</button></header>
    <div class="content"><div class="detail">
      <div class="art${book ? "" : " sq"}">${art}</div>
      <div style="min-width:0">
        <h4>${esc(it.title)}</h4>
        ${tagsHtml(it)}
        <dl>
          ${it.author ? `<dt>Author</dt><dd>${esc(it.author)}</dd>` : ""}
          ${it.isbn ? `<dt>ISBN</dt><dd style="font-variant-numeric:tabular-nums">${esc(it.isbn)}</dd>` : ""}
          ${it.ages ? `<dt>Ages</dt><dd>${esc(it.ages)}</dd>` : ""}
          ${it.forKid && multiKids() ? `<dt>For</dt><dd>${esc(it.forKid)}</dd>` : ""}
          ${it.list === "pass" ? `<dt>Plan</dt><dd>${esc(it.passPlan || "Undecided")}</dd>` : ""}
          ${it.note ? `<dt>Notes</dt><dd>${esc(it.note)}</dd>` : ""}
        </dl>
        ${it.list === "wish" ? `<div class="acts" style="margin-top:10px">${shopLinks(it)}</div>` : ""}
      </div></div>
      ${readBox}
      ${acts}
    </div></div></div>`;
}
function editSheet(m) {
  const it = m.item;
  const book = it.kind === "book";
  const kids = S.lib.kids.map((k) => k.name);
  const otherKids = [...new Set(S.lib.items.map((i) => i.forKid).filter((k) => k && !kids.includes(k)))];
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="et">
    <header><h3 id="et">${m.isNew ? "Add" : "Edit"} ${book ? "a book" : "a toy"}${it.list === "wish" ? " wish" : ""}</h3><button class="btn small ghost" data-act="close" aria-label="Close">Cancel</button></header>
    <form class="content" id="editform">
      <div class="photo-pick">
        <div class="prev" id="prev">${it.photo ? `<img src="${esc(it.photo)}" alt="">` : book ? "No cover yet" : "No photo yet"}</div>
        <div class="field" style="flex:1">
          <label for="f-photo">${book ? "Cover photo" : "Photo"}</label>
          <input id="f-photo" type="file" accept="image/*">
          <span class="hint">${m.uploading ? "Uploading…" : "Snap or choose a picture."} ${it.photo ? `<button type="button" class="btn small ghost" data-act="rm-photo">Remove photo</button>` : ""}</span>
        </div>
      </div>
      ${book ? `<div class="field"><label for="f-isbn">ISBN</label>
        <div class="isbn-row"><input id="f-isbn" inputmode="numeric" autocomplete="off" value="${esc(it.isbn || "")}" placeholder="By the barcode, e.g. 9780064430173">
        <button type="button" class="btn gold" data-act="isbn-lookup">Fill in</button>
        ${canScan ? `<button type="button" class="btn" data-act="isbn-scan">Scan</button>` : ""}</div>
        ${m.scanning ? `<div class="scan"><video id="scan-video" playsinline muted autoplay></video><span class="hint">Point the camera at the barcode on the back.</span><button type="button" class="btn small" data-act="scan-stop">Stop scanning</button></div>` : ""}
        <span class="hint" aria-live="polite">${esc(m.lookup || "Type the ISBN and tap Fill in to get the title, author and cover.")}</span></div>` : ""}
      <div class="field"><label for="f-title">${book ? "Title" : "Name"}</label><input id="f-title" required value="${esc(it.title || "")}"></div>
      ${book ? `<div class="field"><label for="f-author">Author</label><input id="f-author" value="${esc(it.author || "")}"></div>` : ""}
      <div class="field"><span class="lbl">Ages</span><div class="seg">${AGES.map((a) => `<button type="button" class="chip" data-fage="${esc(a)}" aria-pressed="${it.ages === a}">${esc(a)}</button>`).join("")}</div></div>
      <div class="field"><span class="lbl">Tags</span><div class="seg">${TAGS.map((t) => `<button type="button" class="chip" data-ftag="${esc(t)}" aria-pressed="${(it.tags || []).includes(t)}">${esc(t)}</button>`).join("")}</div></div>
      ${multiKids() ? `<div class="field"><span class="lbl">For which child</span><div class="seg">
        <button type="button" class="chip" data-fkid="" aria-pressed="${!it.forKid}">Everyone</button>
        ${kids.concat(otherKids).map((k) => `<button type="button" class="chip kidchip" data-fkid="${esc(k)}" aria-pressed="${it.forKid === k}">${kidByName(k) ? animalSvg(kidByName(k).animal, kidByName(k).color, 20) : ""} ${esc(k)}</button>`).join("")}
      </div></div>` : ""}
      ${it.list === "wish" ? `<div class="field"><label for="f-link">Shop link</label><input id="f-link" type="url" value="${esc(it.link || "")}" placeholder="Paste an Amazon or other store link"><span class="hint">Leave it blank and family get a “Find on Amazon” search instead.</span></div>` : ""}
      <div class="field"><label for="f-note">Notes</label><textarea id="f-note" rows="2" placeholder="${it.list === "wish" ? "Size, color, edition…" : "Who gave it, a favorite page…"}">${esc(it.note || "")}</textarea></div>
      <div class="foot">
        ${m.isNew ? "<span></span>" : `<button type="button" class="btn ghost" data-act="${m.confirmDel ? "del-yes" : "del"}">${m.confirmDel ? "Yes, remove it" : "Remove"}</button>`}
        <button type="submit" class="btn ${book ? "gold" : "primary"}"${m.uploading ? " disabled" : ""}>${m.isNew ? "Add to " + (it.list === "wish" ? "wishing well" : book ? "grove" : "clearing") : "Save changes"}</button>
      </div>
    </form></div></div>`;
}
function kidSheet(m) {
  const k = m.kid;
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="kt">
    <header><h3 id="kt">${m.isNew ? "Add a child" : "Edit " + esc(m.orig)}</h3><button class="btn small ghost" data-act="close">Cancel</button></header>
    <form class="content" id="kidform">
      <div class="kidpreview">${animalSvg(k.animal, k.color, 72)}</div>
      <div class="field"><label for="k-name">Name</label><input id="k-name" required maxlength="30" value="${esc(k.name || "")}"></div>
      <div class="field"><span class="lbl">Forest friend</span><div class="seg">${ANIMALS.map((a) => `<button type="button" class="chip kidchip" data-kanimal="${a}" aria-pressed="${k.animal === a}">${animalSvg(a, k.color, 22)} ${a[0].toUpperCase() + a.slice(1)}</button>`).join("")}</div></div>
      <div class="field"><span class="lbl">Color</span><div class="seg">${KIDCOLORS.map((c) => `<button type="button" class="swatch" data-kcolor="${c}" aria-pressed="${k.color === c}" aria-label="Color ${c}" style="background:${c}"></button>`).join("")}</div></div>
      <div class="field"><label for="k-bday">Birthday</label><input id="k-bday" type="date" value="${esc(k.birthday || "")}"><span class="hint">Optional. Used to suggest the right books and show their age.</span></div>
      <div class="foot">
        ${m.isNew ? "<span></span>" : `<button type="button" class="btn ghost" data-act="${m.confirmDel ? "kid-del-yes" : "kid-del"}">${m.confirmDel ? "Yes, remove " + esc(m.orig) : "Remove child"}</button>`}
        <button type="submit" class="btn primary">${m.isNew ? "Add child" : "Save"}</button>
      </div>
    </form></div></div>`;
}
function storySheet(m) {
  const it = m.item;
  if (!it) return `<div class="scrim" data-act="close"><div class="sheet story" role="dialog" aria-modal="true" aria-labelledby="st">
    <header><h3 id="st">Tonight's story</h3><button class="btn small ghost" data-act="close">Close</button></header>
    <div class="content"><p>There are no books to pick from yet${S.kid ? " for " + esc(S.kid) : ""}. Add a few to the grove first.</p></div></div></div>`;
  return `<div class="scrim" data-act="close"><div class="sheet story" role="dialog" aria-modal="true" aria-labelledby="st">
    <header><h3 id="st">The fireflies chose…</h3><button class="btn small ghost" data-act="close">Close</button></header>
    <div class="content story-body">
      <div class="story-cover" id="story-cover">${bookArt(it)}</div>
      <h4>${esc(it.title)}</h4>
      ${it.author ? `<p class="hint" style="margin:0">by ${esc(it.author)}</p>` : ""}
      ${m.justRead ? `<p class="claimed">${leafSvg(14, "currentColor")} Logged for tonight. Sweet dreams.</p>` : ""}
      <div class="foot" style="justify-content:center">
        <button class="btn" data-act="pick-story">Pick another</button>
        ${S.canEdit && !m.justRead ? `<button class="btn gold" data-act="story-read">We read it${S.kid ? " with " + esc(S.kid) : ""}</button>` : ""}
      </div>
    </div></div></div>`;
}
function pickStory() {
  const kid = kidByName(S.kid);
  const age = kidAgeGroup(kid);
  let pool = S.lib.items.filter((i) => i.kind === "book" && i.list === "own" && matchesKid(i) && !(i.tags || []).includes("Outgrown"));
  if (age) { const fit = pool.filter((i) => !i.ages || i.ages === age); if (fit.length) pool = fit; }
  const prev = S.modal && S.modal.type === "story" && S.modal.item ? S.modal.item.id : null;
  if (pool.length > 1 && prev) pool = pool.filter((i) => i.id !== prev);
  const weighted = pool.flatMap((i) => (i.tags || []).includes("Bedtime") || (i.tags || []).includes("Favorite") ? [i, i] : [i]);
  const item = weighted.length ? weighted[Math.floor(Math.random() * weighted.length)] : null;
  S.modal = { type: "story", item };
  render();
  const c = $("#story-cover");
  if (c) fireflyBurst(c);
}
function fireflyBurst(el) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span"); s.className = "spark burst";
    const a = Math.random() * 6.28, dist = 60 + Math.random() * 90;
    s.style.left = r.left + r.width / 2 - 4 + "px"; s.style.top = r.top + r.height / 2 - 4 + "px";
    s.style.setProperty("--dx", Math.cos(a) * dist + "px"); s.style.setProperty("--dy", Math.sin(a) * dist + "px");
    s.style.animationDelay = Math.random() * 0.25 + "s";
    document.body.appendChild(s); setTimeout(() => s.remove(), 1700);
  }
}

function render() {
  if (!S.lib) return;
  const active = document.activeElement && document.activeElement.id;
  const caret = active === "q" ? $("#q").selectionStart : null;
  const status = S.saveErr ? `<span class="pill err">${esc(S.saveErr)}</span>` : S.saving ? `<span class="pill${S.saving === "Saved" ? " ok" : ""}">${esc(S.saving)}</span>` : "";
  const mode = S.canEdit ? `<span class="pill">You can edit</span>` : "";
  const tabs = [["books", "Books", count("book", "own")], ["toys", "Toys", count("toy", "own")], ["wishlist", "Wishes", count(null, "wish")], ["pass", "Pass-Along", count(null, "pass")]];
  const view = S.tab === "books" ? booksView() : S.tab === "toys" ? toysView() : S.tab === "wishlist" ? wishView() : passView();
  let sheet = "";
  if (S.modal) sheet = S.modal.type === "detail" ? detailSheet(S.modal) : S.modal.type === "edit" ? editSheet(S.modal) : S.modal.type === "kid" ? kidSheet(S.modal) : S.modal.type === "story" ? storySheet(S.modal) : S.modal.type === "auth" ? authSheet(S.modal) : S.modal.type === "quick" ? quickSheet() : renameSheet();
  $("#root").innerHTML = `
    <div class="wrap">
      <header class="top">
        <div class="brand">
          <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3c-11 0-20 6-20 14 0 2 2 3 4 3h32c2 0 4-1 4-3 0-8-9-14-20-14z" fill="#c0473a"/><circle cx="15" cy="11" r="2.6" fill="#fdfbe6"/><circle cx="27" cy="8" r="2" fill="#fdfbe6"/><circle cx="35" cy="14" r="2.4" fill="#fdfbe6"/><path d="M14 20h20v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#efe6cf"/><path d="M21 42v-9a3 3 0 0 1 6 0v9z" fill="#6a3a22"/><circle cx="31" cy="27" r="2.2" fill="#e2b34f"/><path d="M2 44c6-3 10-3 22-3s16 0 22 3z" fill="#2f7a4f"/></svg>
          <div style="min-width:0"><h1>${esc(S.lib.name || "Our Little Library")}</h1><p>Books, toys and wishes</p></div>
        </div>
        <div class="tools">${status}${mode}${S.canEdit ? `<button class="btn small" data-act="rename">Rename</button>` : ""}<button class="btn small" data-act="share">${shareIcon} Share</button></div>
      </header>
      ${S.loadErr ? `<div class="notice"><span>${esc(S.loadErr)}</span></div>` : ""}
      ${kidBar()}
      <nav class="tabs" role="tablist" aria-label="Sections">${tabs.map(([k, l, n]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}"><span class="ti">${TAB_ICONS[k]}</span><span class="tl">${l}</span><span class="n">${n}</span></button>`).join("")}</nav>
      <main>${view}</main>
      <footer class="foot-note">
        <span>${S.canEdit ? "Send family this page's link so they can browse and claim wish-list gifts. They don't need an account." : "Made with love for the little readers and players in this family."}</span>
        ${S.canEdit && !multiKids() ? `<button class="linkish" data-act="add-kid">Add a child</button>` : ""}
        ${S.session ? `<button class="linkish" data-act="signout">Sign out${S.session.user && S.session.user.email ? " (" + esc(S.session.user.email) + ")" : ""}</button>` : `<button class="linkish" data-act="signin">Admin sign in</button>`}
      </footer>
    </div>
    ${S.canEdit ? `<button class="fab" data-act="quick" aria-label="Add something"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>` : ""}
    ${sheet}`;
  if (active) { const el = document.getElementById(active); if (el) { el.focus(); if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret); } }
  if (S.tab === "books") startStars();
}
const shareIcon = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:-2px"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ico = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const TAB_ICONS = {
  books: ico("M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"),
  toys: ico("M8 8a4 4 0 1 1 8 0M5 8h14l-1.5 11a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2zM9 13h6"),
  wishlist: ico("M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"),
  pass: ico("M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9")
};
// The + button's menu: the quickest routes to adding something.
function quickSheet() {
  const big = (act, label, sub, extra = "") => `<button class="quick-b" data-act="${act}" ${extra}><b>${label}</b><span>${sub}</span></button>`;
  return `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="qt">
    <header><h3 id="qt">Add to the library</h3><button class="btn small ghost" data-act="close">Close</button></header>
    <div class="content quick">
      ${canScan ? big("quick-scan", "Scan a book", "Point the camera at the barcode") : ""}
      ${big("add", "Add a book", "Type the title or ISBN", 'data-kind="book" data-list="own"')}
      ${big("add", "Add a toy", "Name it and snap a photo", 'data-kind="toy" data-list="own"')}
      ${big("add", "Wish for a book", "Family can say they'll get it", 'data-kind="book" data-list="wish"')}
      ${big("add", "Wish for a toy", "Family can say they'll get it", 'data-kind="toy" data-list="wish"')}
    </div></div></div>`;
}
async function shareLink() {
  const url = location.origin + location.pathname;
  const name = S.lib.name || "Freddie's Library";
  if (navigator.share) {
    try { await navigator.share({ title: name, text: name + ": books, toys and the wish list", url }); } catch (_) {}
    return;
  }
  try { await navigator.clipboard.writeText(url); S.saving = "Link copied"; } catch (_) { S.saveErr = "Copy this page's address from your browser to share it."; }
  render(); setTimeout(() => { if (S.saving === "Link copied") { S.saving = ""; render(); } }, 2500);
}
function authSheet(m) {
  const up = m.mode === "up";
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="at">
    <header><h3 id="at">${up ? "Create your account" : "Sign in to edit"}</h3><button class="btn small ghost" data-act="close">Cancel</button></header>
    <form class="content" id="authform">
      <p class="hint" style="margin:0">Only the library's owners can edit. Family can browse and claim gifts without signing in.</p>
      <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required value="${esc(m.email || "")}"></div>
      <div class="field"><label for="a-pass">Password</label><input id="a-pass" type="password" minlength="8" autocomplete="${up ? "new-password" : "current-password"}" required>${up ? `<span class="hint">At least 8 characters.</span>` : ""}</div>
      ${m.msg ? `<p class="hint" aria-live="polite" style="margin:0">${esc(m.msg)}</p>` : ""}
      <div class="foot">
        <button type="button" class="btn ghost" data-act="auth-mode">${up ? "I already have an account" : "First time? Create an account"}</button>
        <button type="submit" class="btn primary">${up ? "Create account" : "Sign in"}</button>
      </div>
    </form></div></div>`;
}
function renameSheet() {
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rt">
    <header><h3 id="rt">Name your library</h3><button class="btn small ghost" data-act="close">Cancel</button></header>
    <form class="content" id="renameform"><div class="field"><label for="f-name">Library name</label><input id="f-name" required maxlength="60" value="${esc(S.lib.name || "")}"></div>
    <div class="foot"><span></span><button class="btn primary" type="submit">Save name</button></div></form></div></div>`;
}

/* ---------- fireflies ---------- */
let starRAF = 0;
function startStars() {
  cancelAnimationFrame(starRAF);
  const cv = $("canvas.stars"); if (!cv) return;
  const ctx = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, hh = cv.clientHeight;
  cv.width = w * dpr; cv.height = hh * dpr; ctx.scale(dpr, dpr);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = Array.from({ length: Math.round(w * 110 / 2600) }, () => ({ x: rnd() * w, y: rnd() * 110, r: rnd() * 1.1 + .2, p: rnd() * 6.28, s: rnd() * 1.5 + .4 }))
    .concat(Array.from({ length: Math.max(10, Math.round(w * hh / 14000)) }, () => ({ fly: true, x: rnd() * w, y: 120 + rnd() * (hh - 140), p: rnd() * 6.28, s: rnd() * 1.2 + .5 })));
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = (t) => {
    ctx.clearRect(0, 0, w, hh);
    for (const st of stars) {
      const a = still ? .7 : .3 + .7 * Math.abs(Math.sin(st.p + t / 1000 * st.s));
      if (st.fly) {
        const x = still ? st.x : st.x + Math.sin(t / 2400 * st.s + st.p) * 26, y = still ? st.y : st.y + Math.cos(t / 3100 * st.s + st.p) * 16;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, "rgba(240,255,170," + a + ")"); g.addColorStop(.25, "rgba(210,240,110," + a * .6 + ")"); g.addColorStop(1, "rgba(210,240,110,0)");
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.29); ctx.fill();
      } else {
        ctx.globalAlpha = a * .8; ctx.fillStyle = "#f6f7e6";
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.29); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (!still) starRAF = requestAnimationFrame(draw);
  };
  draw(0);
}
let lastSpark = 0;
document.addEventListener("pointermove", (e) => {
  if (S.tab !== "books" || S.modal || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!e.target.closest || !e.target.closest(".book")) return;
  const now = performance.now(); if (now - lastSpark < 40) return; lastSpark = now;
  const s = document.createElement("span"); s.className = "spark";
  s.style.left = e.clientX - 4 + "px"; s.style.top = e.clientY - 4 + "px";
  s.style.setProperty("--dx", (Math.random() * 40 - 20) + "px"); s.style.setProperty("--dy", (Math.random() * 30 + 10) + "px");
  document.body.appendChild(s); setTimeout(() => s.remove(), 950);
});
window.addEventListener("resize", () => { if (S.tab === "books") startStars(); });

/* ---------- photos ---------- */
// Shrinks a picture in the browser, uploads it to the photos bucket and returns its public address.
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("That picture couldn't be read."))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That file isn't a picture we can read.")); };
    img.src = url;
  });
}
async function uploadPhoto(file) {
  const blob = await shrink(file);
  const path = uid() + ".jpg";
  const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error("The photo couldn't be uploaded. Are you signed in?");
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

/* ---------- ISBN lookup (Open Library) ---------- */
const cleanIsbn = (s) => String(s || "").replace(/[^0-9Xx]/g, "").toUpperCase();
async function lookupIsbn(isbn) {
  const key = "ISBN:" + isbn;
  const r = await fetch("https://openlibrary.org/api/books?format=json&jscmd=data&bibkeys=" + encodeURIComponent(key));
  if (!r.ok) throw new Error("lookup failed");
  const b = (await r.json())[key];
  if (!b) return null;
  return {
    title: [b.title, b.subtitle].filter(Boolean).join(": "),
    author: (b.authors || []).map((a) => a.name).join(", "),
    cover: b.cover ? (b.cover.large || b.cover.medium || "") : ""
  };
}
async function runLookup() {
  keepForm();
  const it = S.modal && S.modal.item; if (!it) return;
  const isbn = cleanIsbn(it.isbn);
  if (isbn.length !== 10 && isbn.length !== 13) { S.modal.lookup = "That doesn't look like an ISBN. It's the 10 or 13 digit number by the barcode."; render(); return; }
  S.modal.lookup = "Looking it up…"; render();
  try {
    const b = await lookupIsbn(isbn);
    if (!S.modal || S.modal.item !== it) return;
    if (!b) { S.modal.lookup = "Open Library doesn't know that one. Type the title in and snap a photo of the cover."; render(); return; }
    it.isbn = isbn;
    if (b.title) it.title = b.title;
    if (b.author) it.author = b.author;
    if (b.cover && !it.photo) it.photo = b.cover;
    S.modal.lookup = b.cover ? "Found it, cover and all." : "Found it. No cover picture there, so snap one if you like.";
  } catch (_) {
    if (S.modal) S.modal.lookup = "Couldn't reach Open Library just now. Try again in a moment.";
  }
  render();
}
// Uses the phone's built-in barcode reader where there is one (Android Chrome) and a
// downloadable one everywhere else (iPhone, Firefox, desktop), loaded only when needed.
const canScan = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
async function barcodeReader() {
  const formats = ["ean_13", "upc_a"];
  if ("BarcodeDetector" in window) {
    const ok = await BarcodeDetector.getSupportedFormats().catch(() => []);
    if (ok.includes("ean_13")) return new BarcodeDetector({ formats });
  }
  const { BarcodeDetector: Fallback } = await import("https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/pure/+esm");
  return new Fallback({ formats });
}
async function scanBarcode() {
  if (!canScan) return;
  S.modal.scanning = true; render();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const det = await barcodeReader();
    const until = Date.now() + 30000;
    while (S.modal && S.modal.scanning && Date.now() < until) {
      // A re-render swaps the video element, so reattach the camera when that happens.
      const video = $("#scan-video"); if (!video) break;
      if (video.srcObject !== stream) { video.srcObject = stream; await video.play().catch(() => {}); }
      const codes = await det.detect(video).catch(() => []);
      const hit = codes.map((c) => cleanIsbn(c.rawValue)).find((v) => /^97[89]\d{10}$/.test(v));
      if (hit) { keepForm(); S.modal.item.isbn = hit; S.modal.scanning = false; render(); stream.getTracks().forEach((t) => t.stop()); return runLookup(); }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (S.modal && S.modal.scanning) S.modal.lookup = "Didn't catch a barcode. Try again with more light, or type the ISBN.";
  } catch (_) {
    if (S.modal) S.modal.lookup = stream ? "The barcode reader couldn't load. Type the ISBN instead." : "The camera couldn't start. Allow camera access, or type the ISBN instead.";
  }
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (S.modal) { S.modal.scanning = false; render(); }
}
/* ---------- events ---------- */
const findItem = (id) => S.lib.items.find((i) => i.id === id);
function keepKidForm() {
  const k = S.modal && S.modal.kid; if (!k) return;
  const n = document.getElementById("k-name"), b = document.getElementById("k-bday");
  if (n) k.name = n.value.trim(); if (b) k.birthday = b.value;
}
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, .scrim, [data-act]");
  if (!t) return;
  const d = t.dataset;
  if (t.classList.contains("scrim") && e.target !== t) return;
  if (d.tab) { S.tab = d.tab; S.q = ""; S.age = ""; S.tag = ""; try { localStorage.setItem("ss-tab", S.tab); } catch (_) {} render(); window.scrollTo(0, 0); return; }
  if (d.kid !== undefined) { S.kid = d.kid; try { localStorage.setItem("ss-kid", S.kid); } catch (_) {} render(); return; }
  if (d.age !== undefined) { S.age = S.age === d.age ? "" : d.age; render(); return; }
  if (d.tag !== undefined) { S.tag = S.tag === d.tag ? "" : d.tag; render(); return; }
  if (d.open) { const it = findItem(d.open); if (it) { S.modal = { type: "detail", item: it }; render(); } return; }
  if (d.edit) { const it = findItem(d.edit); S.modal = { type: "edit", item: JSON.parse(JSON.stringify(it)), isNew: false }; render(); return; }
  if (d.fage !== undefined) { keepForm(); S.modal.item.ages = S.modal.item.ages === d.fage ? "" : d.fage; render(); return; }
  if (d.ftag) { keepForm(); const tg = S.modal.item.tags || (S.modal.item.tags = []); const i = tg.indexOf(d.ftag); i < 0 ? tg.push(d.ftag) : tg.splice(i, 1); render(); return; }
  if (d.fkid !== undefined) { keepForm(); S.modal.item.forKid = d.fkid; render(); return; }
  if (d.kanimal) { keepKidForm(); S.modal.kid.animal = d.kanimal; render(); return; }
  if (d.kcolor) { keepKidForm(); S.modal.kid.color = d.kcolor; render(); return; }
  if (d.read !== undefined && S.modal) { logRead(S.modal.item, d.read); S.modal.justRead = true; render(); return; }
  if (d.plan) { const it = S.modal.item; it.list = "pass"; it.passPlan = d.plan; it.stored = false; S.modal.passPick = false; changed(); return; }
  if (d.claim) { S.claimOpen = d.claim; render(); const inp = document.getElementById("claim-name-" + d.claim); if (inp) inp.focus(); return; }
  if (d.unclaim) { const { error } = await sb.rpc("unclaim_item", { p_item_id: d.unclaim, p_token: claimToken() }); if (error) { S.saveErr = "Couldn't undo the claim just now."; render(); } else loadClaims(); return; }
  if (d.got) { const it = findItem(d.got); if (it) { it.list = "own"; if (S.claims[it.id]) sb.rpc("unclaim_item", { p_item_id: it.id, p_token: claimToken() }).then(loadClaims); changed(); } return; }
  switch (d.act) {
    case "close": S.modal = null; render(); break;
    case "isbn-lookup": runLookup(); break;
    case "isbn-scan": keepForm(); scanBarcode(); break;
    case "scan-stop": S.modal.scanning = false; render(); break;
    case "signin": S.modal = { type: "auth", mode: "in" }; render(); $("#a-email") && $("#a-email").focus(); break;
    case "auth-mode": S.modal.mode = S.modal.mode === "in" ? "up" : "in"; S.modal.msg = ""; render(); break;
    case "signout": await sb.auth.signOut(); S.modal = null; break;
    case "share": shareLink(); break;
    case "quick": S.modal = { type: "quick" }; render(); break;
    case "quick-scan": S.tab = "books"; S.modal = { type: "edit", isNew: true, item: { id: uid(), kind: "book", list: "own", title: "", tags: [], ages: "", forKid: "" } }; render(); scanBarcode(); break;
    case "add": S.modal = { type: "edit", isNew: true, item: { id: uid(), kind: d.kind, list: d.list, title: "", tags: [], ages: kidAgeGroup(kidByName(S.kid)), forKid: S.kid } }; render(); $("#f-title") && $("#f-title").focus(); break;
    case "add-kid": S.modal = { type: "kid", isNew: true, kid: { id: uid(), name: "", animal: ANIMALS[S.lib.kids.length % ANIMALS.length], color: KIDCOLORS[S.lib.kids.length % KIDCOLORS.length], birthday: "" } }; render(); $("#k-name") && $("#k-name").focus(); break;
    case "edit-kid": { const k = kidByName(S.kid); if (k) { S.modal = { type: "kid", isNew: false, orig: k.name, kid: { ...k } }; render(); } break; }
    case "kid-del": keepKidForm(); S.modal.confirmDel = true; render(); break;
    case "kid-del-yes": S.lib.kids = S.lib.kids.filter((k) => k.name !== S.modal.orig); S.kid = ""; S.modal = null; changed(); break;
    case "rename": S.modal = { type: "rename" }; render(); break;
    case "rm-photo": keepForm(); S.modal.item.photo = ""; render(); break;
    case "del": keepForm(); S.modal.confirmDel = true; render(); break;
    case "del-detail": S.modal.confirmDel = true; render(); break;
    case "del-yes": S.lib.items = S.lib.items.filter((i) => i.id !== S.modal.item.id); S.modal = null; changed(); break;
    case "clear-examples": S.lib.items = S.lib.items.filter((i) => !i.example); changed(); break;
    case "toggle-claimers": S.showClaimers = !S.showClaimers; render(); break;
    case "claim-cancel": S.claimOpen = null; render(); break;
    case "pick-story": pickStory(); break;
    case "story-read": logRead(S.modal.item, S.kid); S.modal.justRead = true; render(); break;
    case "toggle-store": S.modal.item.stored = !S.modal.item.stored; changed(); break;
    case "pass-pick": S.modal.passPick = true; render(); break;
    case "pass-back": S.modal.item.list = "own"; S.modal.item.tags = (S.modal.item.tags || []).filter((x) => x !== "Outgrown"); S.modal = null; changed(); break;
    case "move-outgrown": S.lib.items.forEach((i) => { if (i.kind === d.kind && i.list === "own" && (i.tags || []).includes("Outgrown")) { i.list = "pass"; i.passPlan = i.passPlan || "Undecided"; i.stored = false; } }); changed(); break;
    case "rotate": rotateToys(); break;
    case "dismiss-rotate": S.rotateMsg = ""; render(); break;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && S.modal) { S.modal = null; render(); }
  if (e.key === "Enter" && e.target.id === "f-isbn") { e.preventDefault(); runLookup(); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "q") { S.q = e.target.value; render(); }
});
function keepForm() {
  const it = S.modal && S.modal.item; if (!it || S.modal.type !== "edit") return;
  const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };
  for (const [k, id] of [["title", "f-title"], ["author", "f-author"], ["isbn", "f-isbn"], ["link", "f-link"], ["note", "f-note"]]) { const x = v(id); if (x !== undefined) it[k] = x; }
}
document.addEventListener("change", async (e) => {
  if (e.target.id === "f-photo" && e.target.files[0]) {
    keepForm();
    const it = S.modal.item;
    S.modal.uploading = true; render();
    try { it.photo = await uploadPhoto(e.target.files[0]); } catch (err) { S.saveErr = err.message; }
    if (S.modal) S.modal.uploading = false;
    render();
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "editform") {
    keepForm();
    const it = S.modal.item;
    if (!it.title) return;
    if (it.link && !/^https?:\/\//i.test(it.link)) it.link = "https://" + it.link;
    delete it.example;
    const i = S.lib.items.findIndex((x) => x.id === it.id);
    if (i >= 0) S.lib.items[i] = it; else S.lib.items.push(it);
    S.modal = null; changed();
  } else if (e.target.id === "kidform") {
    keepKidForm();
    const m = S.modal, k = m.kid;
    if (!k.name) return;
    if (S.lib.kids.some((x) => x.name.toLowerCase() === k.name.toLowerCase() && x.name !== m.orig)) { S.saveErr = "There's already a child named " + k.name + "."; render(); return; }
    if (m.isNew) S.lib.kids.push(k);
    else {
      S.lib.kids = S.lib.kids.map((x) => (x.name === m.orig ? k : x));
      if (k.name !== m.orig) S.lib.items.forEach((i) => { if (i.forKid === m.orig) i.forKid = k.name; (i.reads || []).forEach((r) => { if (r.k === m.orig) r.k = k.name; }); });
    }
    S.kid = multiKids() ? k.name : ""; try { localStorage.setItem("ss-kid", S.kid); } catch (_) {}
    S.modal = null; changed();
  } else if (e.target.id === "authform") {
    const email = $("#a-email").value.trim(), password = $("#a-pass").value;
    S.modal.email = email; S.modal.msg = S.modal.mode === "in" ? "Signing in…" : "Creating your account…"; render();
    const opts = { emailRedirectTo: location.origin + location.pathname };
    const { data, error } = S.modal.mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: opts });
    if (!S.modal || S.modal.type !== "auth") return;
    if (error) { S.modal.msg = error.message; render(); return; }
    if (S.modal.mode === "up" && !data.session) { S.modal.msg = "Check your email for a confirmation link, then come back and sign in."; S.modal.mode = "in"; render(); return; }
    S.modal = null; await refreshAuth();
    if (!S.canEdit) { S.saveErr = "You're signed in, but this account isn't set up to edit the library."; render(); }
  } else if (e.target.id === "renameform") {
    const n = $("#f-name").value.trim(); if (n) { S.lib.name = n; S.modal = null; changed(); }
  } else if (e.target.dataset.claimform) {
    const id = e.target.dataset.claimform;
    const who = e.target.who.value.trim(); if (!who) return;
    S.myName = who;
    try { localStorage.setItem("fl-name", who); } catch (_) {}
    const { error } = await sb.rpc("claim_item", { p_item_id: id, p_name: who, p_token: claimToken() });
    if (error) {
      S.saveErr = error.code === "23505" ? "Someone just claimed that one. Pick another wish?" : "Couldn't save your claim just now.";
      S.claimOpen = null;
    } else { S.claimOpen = null; S.saveErr = ""; }
    loadClaims();
  }
});

/* ---------- sign in ---------- */
async function refreshAuth() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.canEdit = false;
  if (S.session) {
    const { data: ok } = await sb.rpc("is_editor");
    S.canEdit = !!ok;
  }
  render();
}

async function boot() {
  await load();
  render();
  await refreshAuth();
  loadClaims();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") refreshAuth(); });
  // Keep claims and the catalog fresh when family come back to the tab.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    loadClaims();
    if (!S.modal && !S.saving) load().then(render);
  });
  setInterval(() => { if (document.visibilityState === "visible") loadClaims(); }, 60000);
}
boot();
// Lets the library open with no signal and be added to the home screen as an app.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

