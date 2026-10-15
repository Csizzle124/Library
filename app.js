import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const JEWELS = ["#2c4a2e", "#5a2a24", "#1f4a4a", "#4b3a1c", "#3d2a4a", "#24533f", "#6a3a22", "#2f3f22"];
const TOYCOLORS = ["#c0473a", "#4f8a8b", "#5e9a4a", "#d39a32", "#8a6a9e", "#b5653a"];
const SHOWS = [["all", "Everything"], ["book", "Books"], ["toy", "Toys"], ["wish", "Wish list"]];

/* ---------- state ---------- */
const S = {
  items: [], loaded: false, loadErr: "", show: "all", q: "",
  modal: null, claimOpen: null, status: "", err: "",
  session: null, admin: false, myName: "", myClaims: []
};
try {
  S.myName = localStorage.getItem("fl-name") || "";
  S.myClaims = JSON.parse(localStorage.getItem("fl-claims") || "[]");
  const s = localStorage.getItem("fl-show"); if (SHOWS.some(([k]) => k === s)) S.show = s;
} catch (_) {}
const remember = (k, v) => { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch (_) {} };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hash = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };

/* ---------- data ---------- */
async function load() {
  const { data, error } = await sb.from("items").select("*").order("created_at");
  if (error) { S.loadErr = "The list couldn't be reached just now. Try reloading in a moment."; }
  else { S.loadErr = ""; S.items = data; }
  S.loaded = true;
  render();
}
// Only the signed-in admin (an email in the editors table) can change the list.
async function refreshAuth() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.admin = false;
  if (S.session) { const { data: ok } = await sb.rpc("is_editor"); S.admin = !!ok; }
  render();
}
function flash(msg) {
  S.status = msg; S.err = ""; render();
  setTimeout(() => { if (S.status === msg) { S.status = ""; render(); } }, 2500);
}

/* ---------- pictures ---------- */
function bookArt(it) {
  if (it.photo) return `<img src="${esc(it.photo)}" alt="" loading="lazy">`;
  return `<div class="made" style="background:radial-gradient(120% 70% at 50% 0%, rgb(255 255 255 / .14), transparent 60%), ${JEWELS[hash(it.title) % JEWELS.length]}">
    ${leafSvg(20)}<span class="t">${esc(it.title)}</span><span class="a">${esc(it.author || "")}</span></div>`;
}
function toyArt(it) {
  if (it.photo) return `<img src="${esc(it.photo)}" alt="" loading="lazy">`;
  return `<span class="block">${esc((String(it.title).trim()[0] || "?").toUpperCase())}</span>`;
}
const leafSvg = (s = 22, c = "#f0dd8c") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M20 3C11 3 4 8 4 15c0 2 .6 3.6 1.4 4.8L3 22l1.4 1.4 2.4-2.4C8 21.6 9.6 22 11 22c7 0 10-8 9-19zM8 18c2-4 5-7 9-9-3 3-5.5 6-7.5 9.6z"/></svg>`;
const starSvg = (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5l2.6 7 7.4.3-5.8 4.6 2 7.1L12 16.4 5.8 20.5l2-7.1L2 8.8l7.4-.3z"/></svg>`;

// Shrinks a photo in the browser so it can be stored with the item.
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 420, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That file isn't a picture we can read.")); };
    img.src = url;
  });
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
async function scanBarcode() {
  if (!("BarcodeDetector" in window)) return;
  S.modal.scanning = true; render();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const det = new BarcodeDetector({ formats: ["ean_13", "upc_a"] });
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
  } catch (_) {
    if (S.modal) S.modal.lookup = "The camera couldn't start. Type the ISBN instead.";
  }
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (S.modal) { S.modal.scanning = false; render(); }
}

/* ---------- views ---------- */
function shown() {
  const q = S.q.trim().toLowerCase();
  return S.items.filter((it) =>
    (S.show === "all" || (S.show === "wish" ? it.wish : it.kind === S.show)) &&
    (!q || [it.title, it.author, it.note].join(" ").toLowerCase().includes(q))
  ).sort((a, b) => (b.wish - a.wish) || String(a.title).localeCompare(String(b.title)));
}
function claimHtml(it) {
  if (!it.wish) return "";
  if (it.claimed_by) {
    const mine = S.myClaims.includes(it.id);
    return `<span class="claimed">${starSvg()} ${mine ? "You're getting this" : "Someone's getting this"}</span>
      ${mine ? `<button class="btn small ghost" data-unclaim="${esc(it.id)}">Undo</button>` : ""}`;
  }
  if (S.claimOpen === it.id) {
    return `<form class="claimform" data-claimform="${esc(it.id)}">
      <input id="claim-name" name="who" required maxlength="40" placeholder="Your name, like Aunt Jo" value="${esc(S.myName)}" aria-label="Your name">
      <button class="btn small primary" type="submit">Claim it</button>
      <button class="btn small ghost" type="button" data-act="claim-cancel">Cancel</button></form>`;
  }
  return `<button class="btn small primary" data-claim="${esc(it.id)}">I'll get this</button>`;
}
function amazonLink(it) {
  const url = "https://www.amazon.com/s?k=" + encodeURIComponent([it.title, it.author].filter(Boolean).join(" ")) + (it.kind === "book" ? "&i=stripbooks" : "&i=toys-and-games");
  return `<a class="shop amz" href="${esc(url)}" target="_blank" rel="noopener">Find on Amazon</a>`;
}
function card(it) {
  const book = it.kind === "book";
  const bg = book ? "" : `style="background:${TOYCOLORS[hash(it.title) % TOYCOLORS.length]}"`;
  return `<article class="entry${it.wish ? " is-wish" : ""}${it.claimed_by ? " is-claimed" : ""}">
    ${it.wish ? `<span class="ribbon" aria-hidden="true"></span>` : ""}
    ${S.admin ? `<button class="pic${book ? "" : " sq"}" ${bg} data-edit="${esc(it.id)}" aria-label="Edit ${esc(it.title)}">${book ? bookArt(it) : toyArt(it)}</button>` :
      `<div class="pic${book ? "" : " sq"}" ${bg}>${book ? bookArt(it) : toyArt(it)}</div>`}
    <div class="body">
      <span class="et">${esc(it.title)}</span>
      ${it.author ? `<span class="hint">by ${esc(it.author)}</span>` : ""}
      ${it.note ? `<span class="note">${esc(it.note)}</span>` : ""}
      <div class="meta"><span class="tag">${book ? "Book" : "Toy"}</span>${it.wish ? `<span class="tag fav">Wish</span>` : ""}</div>
      ${it.wish ? `<div class="acts">${claimHtml(it)}${it.claimed_by ? "" : amazonLink(it)}</div>` : ""}
    </div>
  </article>`;
}
function editSheet(m) {
  const it = m.item;
  const book = it.kind === "book";
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="et">
    <header><h3 id="et">${m.isNew ? "Add to the list" : "Edit"}</h3><button class="btn small ghost" data-act="close">Cancel</button></header>
    <form class="content" id="editform">
      <div class="field"><span class="lbl">What is it?</span><div class="seg">
        <button type="button" class="chip" data-fkind="book" aria-pressed="${book}">Book</button>
        <button type="button" class="chip" data-fkind="toy" aria-pressed="${!book}">Toy</button>
        <button type="button" class="chip" data-act="fwish" aria-pressed="${!!it.wish}">${starSvg(12)} On the wish list</button>
      </div></div>
      ${book ? `<div class="field"><label for="f-isbn">ISBN</label>
        <div class="isbn-row"><input id="f-isbn" inputmode="numeric" autocomplete="off" value="${esc(it.isbn || "")}" placeholder="By the barcode, e.g. 9780064430173">
        <button type="button" class="btn gold" data-act="isbn-lookup">Fill in</button>
        ${"BarcodeDetector" in window ? `<button type="button" class="btn" data-act="isbn-scan">Scan</button>` : ""}</div>
        ${m.scanning ? `<div class="scan"><video id="scan-video" playsinline muted></video><button type="button" class="btn small" data-act="scan-stop">Stop scanning</button></div>` : ""}
        <span class="hint" aria-live="polite">${esc(m.lookup || "Type the ISBN and tap Fill in to get the title, author and cover.")}</span></div>` : ""}
      <div class="field"><label for="f-title">${book ? "Title" : "Name"}</label><input id="f-title" required maxlength="200" value="${esc(it.title || "")}"></div>
      ${book ? `<div class="field"><label for="f-author">Author</label><input id="f-author" maxlength="200" value="${esc(it.author || "")}"></div>` : ""}
      <div class="photo-pick">
        <div class="prev" id="prev">${it.photo ? `<img src="${esc(it.photo)}" alt="">` : "No picture yet"}</div>
        <div class="field" style="flex:1">
          <label for="f-photo">${book ? "Cover photo" : "Photo"}</label>
          <input id="f-photo" type="file" accept="image/*">
          ${it.photo ? `<span><button type="button" class="btn small ghost" data-act="rm-photo">Remove picture</button></span>` : ""}
        </div>
      </div>
      <div class="field"><label for="f-note">Notes</label><textarea id="f-note" rows="2" maxlength="500" placeholder="${it.wish ? "Size, color, edition…" : "Who gave it, a favorite page…"}">${esc(it.note || "")}</textarea></div>
      ${!m.isNew && it.claimed_by ? `<p class="hint" style="margin:0">Someone has said they'll get this.${m.peek ? ` It's <b>${esc(it.claimed_by)}</b>.` : ` <button type="button" class="btn small ghost" data-act="peek">Peek at who</button>`}</p>` : ""}
      <div class="foot">
        ${m.isNew ? "<span></span>" : `<button type="button" class="btn ghost" data-act="${m.confirmDel ? "del-yes" : "del"}">${m.confirmDel ? "Yes, remove it" : "Remove"}</button>`}
        <button type="submit" class="btn primary"${m.busy ? " disabled" : ""}>${m.isNew ? "Add it" : "Save"}</button>
      </div>
    </form></div></div>`;
}
function authSheet(m) {
  const up = m.mode === "up";
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="at">
    <header><h3 id="at">${up ? "Create the admin account" : "Admin sign in"}</h3><button class="btn small ghost" data-act="close">Cancel</button></header>
    <form class="content" id="authform">
      <p class="hint" style="margin:0">Only the admin can change the list. Everyone else can look and claim gifts without signing in.</p>
      <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required value="${esc(m.email || "")}"></div>
      <div class="field"><label for="a-pass">Password</label><input id="a-pass" type="password" minlength="8" autocomplete="${up ? "new-password" : "current-password"}" required>${up ? `<span class="hint">At least 8 characters.</span>` : ""}</div>
      ${m.msg ? `<p class="hint" aria-live="polite" style="margin:0">${esc(m.msg)}</p>` : ""}
      <div class="foot">
        <button type="button" class="btn ghost" data-act="auth-mode">${up ? "I already have an account" : "First time? Create the account"}</button>
        <button type="submit" class="btn primary">${up ? "Create account" : "Sign in"}</button>
      </div>
    </form></div></div>`;
}

function render() {
  const active = document.activeElement && document.activeElement.id;
  const caret = active === "q" ? $("#q").selectionStart : null;
  const items = shown();
  const count = (k) => S.items.filter((it) => k === "all" || (k === "wish" ? it.wish : it.kind === k)).length;
  const status = S.err ? `<span class="pill err">${esc(S.err)}</span>` : S.status ? `<span class="pill ok">${esc(S.status)}</span>` : "";
  const sheet = !S.modal ? "" : S.modal.type === "edit" ? editSheet(S.modal) : authSheet(S.modal);
  $("#root").innerHTML = `
    <div class="wrap">
      <header class="top">
        <div class="brand">
          <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3c-11 0-20 6-20 14 0 2 2 3 4 3h32c2 0 4-1 4-3 0-8-9-14-20-14z" fill="#c0473a"/><circle cx="15" cy="11" r="2.6" fill="#fdfbe6"/><circle cx="27" cy="8" r="2" fill="#fdfbe6"/><circle cx="35" cy="14" r="2.4" fill="#fdfbe6"/><path d="M14 20h20v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#efe6cf"/><path d="M21 42v-9a3 3 0 0 1 6 0v9z" fill="#6a3a22"/><circle cx="31" cy="27" r="2.2" fill="#e2b34f"/><path d="M2 44c6-3 10-3 22-3s16 0 22 3z" fill="#2f7a4f"/></svg>
          <div style="min-width:0"><h1>Freddie's Library</h1><p>Books, toys and wishes</p></div>
        </div>
        <div class="tools">${status}${S.admin ? `<button class="btn primary" data-act="add">Add</button>` : ""}</div>
      </header>
      ${S.loadErr ? `<div class="notice"><span>${esc(S.loadErr)}</span></div>` : ""}
      <section class="night" aria-label="The list">
        <canvas class="stars" aria-hidden="true"></canvas>
        <div class="inner">
          <p class="eyebrow">Deep in the whispering woods…</p>
          <div class="filters">
            <input class="search" id="q" type="search" placeholder="Search the list" value="${esc(S.q)}" aria-label="Search">
            ${SHOWS.map(([k, l]) => `<button class="chip" data-show="${k}" aria-pressed="${S.show === k}">${l} <span class="n">${count(k)}</span></button>`).join("")}
          </div>
          ${!S.loaded ? `<div class="empty">Opening the library…</div>` : items.length ? `<div class="list">${items.map(card).join("")}</div>` :
            `<div class="empty">${S.q || S.show !== "all" ? "Nothing matches that." : S.admin ? "The list is empty. Tap Add to put the first book or toy in." : "Nothing on the list yet."}</div>`}
        </div>
      </section>
      <footer class="foot-note"><span>Planning a gift? Tap “I'll get this” on a wish so nobody buys the same thing twice.</span>
        <span class="foot-acts"><button class="linkish" data-act="copy-link">Copy link to share</button>
        ${S.session ? `<button class="linkish" data-act="signout">Sign out</button>` : `<button class="linkish" data-act="signin">Admin sign in</button>`}</span></footer>
    </div>
    ${sheet}`;
  if (active) { const el = document.getElementById(active); if (el) { el.focus(); if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret); } }
  startStars();
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
  const flies = Array.from({ length: Math.max(10, Math.round(w * hh / 18000)) }, () => ({ x: rnd() * w, y: rnd() * hh, p: rnd() * 6.28, s: rnd() * 1.2 + .5 }));
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = (t) => {
    ctx.clearRect(0, 0, w, hh);
    for (const f of flies) {
      const a = still ? .7 : .3 + .7 * Math.abs(Math.sin(f.p + t / 1000 * f.s));
      const x = still ? f.x : f.x + Math.sin(t / 2400 * f.s + f.p) * 26, y = still ? f.y : f.y + Math.cos(t / 3100 * f.s + f.p) * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, "rgba(240,255,170," + a + ")"); g.addColorStop(.25, "rgba(210,240,110," + a * .6 + ")"); g.addColorStop(1, "rgba(210,240,110,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.29); ctx.fill();
    }
    if (!still) starRAF = requestAnimationFrame(draw);
  };
  draw(0);
}
window.addEventListener("resize", startStars);

/* ---------- saving ---------- */
function keepForm() {
  const it = S.modal && S.modal.type === "edit" && S.modal.item; if (!it) return;
  for (const [k, id] of [["title", "f-title"], ["author", "f-author"], ["isbn", "f-isbn"], ["note", "f-note"]]) {
    const el = document.getElementById(id); if (el) it[k] = el.value.trim();
  }
}
async function saveItem() {
  keepForm();
  const it = S.modal.item;
  if (!it.title) return;
  if (it.kind !== "book") { it.author = ""; it.isbn = ""; }
  S.modal.busy = true; render();
  const row = { kind: it.kind, title: it.title, author: it.author || null, isbn: it.isbn || null, photo: it.photo || null, note: it.note || null, wish: !!it.wish };
  if (!row.wish) row.claimed_by = null;
  const q = it.id ? sb.from("items").update(row).eq("id", it.id) : sb.from("items").insert(row);
  const { data, error } = await q.select().single();
  if (!S.modal) return;
  S.modal.busy = false;
  if (error) { S.err = "Couldn't save just now. Are you still signed in?"; render(); return; }
  const i = S.items.findIndex((x) => x.id === data.id);
  if (i >= 0) S.items[i] = data; else S.items.push(data);
  S.modal = null; flash("Saved");
}

/* ---------- events ---------- */
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-act]");
  if (!t) return;
  const d = t.dataset;
  if (d.show) { S.show = d.show; remember("fl-show", S.show); render(); return; }
  if (d.edit) { const it = S.items.find((x) => x.id === d.edit); if (it) { S.modal = { type: "edit", item: { ...it } }; render(); } return; }
  if (d.fkind) { keepForm(); S.modal.item.kind = d.fkind; render(); return; }
  if (d.claim) { S.claimOpen = d.claim; render(); $("#claim-name") && $("#claim-name").focus(); return; }
  if (d.unclaim) {
    const { data, error } = await sb.rpc("unclaim_wish", { p_id: d.unclaim });
    if (error) { S.err = "Couldn't undo just now."; render(); return; }
    S.myClaims = S.myClaims.filter((x) => x !== d.unclaim); remember("fl-claims", S.myClaims);
    const i = S.items.findIndex((x) => x.id === d.unclaim); if (i >= 0 && data) S.items[i] = data;
    render(); return;
  }
  switch (d.act) {
    case "add": S.modal = { type: "edit", isNew: true, item: { kind: S.show === "toy" ? "toy" : "book", wish: S.show === "wish", title: "" } }; render(); break;
    case "close": S.modal = null; render(); break;
    case "signin": S.modal = { type: "auth", mode: "in" }; render(); $("#a-email") && $("#a-email").focus(); break;
    case "auth-mode": S.modal.mode = S.modal.mode === "in" ? "up" : "in"; S.modal.msg = ""; render(); break;
    case "signout": await sb.auth.signOut(); break;
    case "fwish": keepForm(); S.modal.item.wish = !S.modal.item.wish; render(); break;
    case "rm-photo": keepForm(); S.modal.item.photo = ""; render(); break;
    case "peek": keepForm(); S.modal.peek = true; render(); break;
    case "isbn-lookup": runLookup(); break;
    case "isbn-scan": keepForm(); scanBarcode(); break;
    case "scan-stop": S.modal.scanning = false; render(); break;
    case "del": keepForm(); S.modal.confirmDel = true; render(); break;
    case "del-yes": {
      const id = S.modal.item.id;
      const { error } = await sb.from("items").delete().eq("id", id);
      if (error) { S.err = "Couldn't remove it just now."; render(); break; }
      S.items = S.items.filter((x) => x.id !== id); S.modal = null; flash("Removed");
      break;
    }
    case "claim-cancel": S.claimOpen = null; render(); break;
    case "copy-link":
      try { await navigator.clipboard.writeText(location.origin + location.pathname); flash("Link copied"); }
      catch (_) { S.err = "Copy this page's address from your browser to share it."; render(); }
      break;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && S.modal) { S.modal = null; render(); }
  if (e.key === "Enter" && e.target.id === "f-isbn") { e.preventDefault(); runLookup(); }
});
document.addEventListener("input", (e) => { if (e.target.id === "q") { S.q = e.target.value; render(); } });
document.addEventListener("change", async (e) => {
  if (e.target.id === "f-photo" && e.target.files[0]) {
    keepForm();
    try { S.modal.item.photo = await shrink(e.target.files[0]); } catch (err) { S.err = err.message; }
    render();
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "editform") saveItem();
  else if (e.target.id === "authform") {
    const email = $("#a-email").value.trim(), password = $("#a-pass").value;
    const up = S.modal.mode === "up";
    S.modal.email = email; S.modal.msg = up ? "Creating the account…" : "Signing in…"; render();
    const { data, error } = up
      ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
      : await sb.auth.signInWithPassword({ email, password });
    if (!S.modal || S.modal.type !== "auth") return;
    if (error) { S.modal.msg = error.message; render(); return; }
    if (up && !data.session) { S.modal.msg = "Check your email for a confirmation link, then come back and sign in."; S.modal.mode = "in"; render(); return; }
    S.modal = null; await refreshAuth();
    if (!S.admin) { S.err = "You're signed in, but this account isn't the admin."; render(); }
  } else if (e.target.dataset.claimform) {
    const id = e.target.dataset.claimform;
    const who = e.target.who.value.trim(); if (!who) return;
    S.myName = who; remember("fl-name", who);
    const { data, error } = await sb.rpc("claim_wish", { p_id: id, p_name: who });
    S.claimOpen = null;
    if (error || !data || !data.id) { S.err = "Someone may have just claimed that one. Reloading the list."; load(); return; }
    S.myClaims.push(id); remember("fl-claims", S.myClaims);
    const i = S.items.findIndex((x) => x.id === id); if (i >= 0) S.items[i] = data;
    render();
  }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !S.modal) load(); });

render();
load();
refreshAuth();
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") refreshAuth(); });
