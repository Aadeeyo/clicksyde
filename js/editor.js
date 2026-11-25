/* Clicksyde: edit page copy in place. Opened from the admin panel (Page copy), which adds ?edit=1 to a page.
   Every text marked data-copy="<page>.<n>" becomes editable. Saving stores the changed texts in
   site_content.data.copy (live, for signed-in admins) or in this browser's demo store (demo mode). */
(function () {
  const D = window.CS, S = window.CSstore, ORIG = window.CScopyOriginal || {}, CFG = D.supabase || {};
  const $ = (s, r = document) => r.querySelector(s);
  const els = Array.from(document.querySelectorAll("[data-copy]"));
  const base = {};               // what each text says now (saved state)
  const changed = new Map();     // key -> new html, or null = back to the original wording
  const stored = Object.assign({}, D.copy || {});
  els.forEach((el) => { base[el.dataset.copy] = S.cleanCopy(el.innerHTML); });

  const css = document.createElement("style");
  css.textContent = `
    body.cs-editing { padding-bottom: 96px; }
    body.cs-editing .dock, body.cs-editing .demo-banner { display: none !important; }
    body.cs-editing .rv { opacity: 1 !important; transform: none !important; }
    body.cs-editing .sh-card { pointer-events: auto !important; }
    body.cs-editing [data-copy] { outline: 1px dashed rgba(255,67,6,.6); outline-offset: 3px; cursor: text; border-radius: 2px; }
    body.cs-editing [data-copy]:hover { outline-style: solid; }
    body.cs-editing [data-copy]:focus { outline: 2px solid #171512; outline-offset: 3px; }
    body.cs-editing [data-copy].cs-changed { outline: 2px solid #FF4306; background: rgba(255,67,6,.08); }
    #cs-editbar { position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 300; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
      padding: 12px 14px; border-radius: 18px; background: rgba(23,21,18,.94); color: #F7F6F3; font: 500 14px/1.4 Manrope, system-ui, sans-serif;
      box-shadow: 0 20px 50px -20px rgba(0,0,0,.6); backdrop-filter: blur(14px); }
    #cs-editbar b { font-weight: 700; }
    #cs-editbar .grow { flex: 1 1 220px; color: rgba(247,246,243,.7); }
    #cs-editbar button { border: 0; border-radius: 12px; padding: 10px 16px; font: 700 14px Manrope, system-ui, sans-serif; cursor: pointer; }
    #cs-editbar .save { background: linear-gradient(180deg,#FF5B22,#F13C02); color: #fff; }
    #cs-editbar .save[disabled] { opacity: .45; cursor: default; }
    #cs-editbar .ghost { background: rgba(255,255,255,.1); color: #F7F6F3; }
    #cs-editbar .ghost[disabled] { opacity: .35; cursor: default; }
    #cs-toast { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 301; padding: 10px 16px; border-radius: 12px; background: #171512; color: #fff;
      font: 600 14px Manrope, system-ui, sans-serif; opacity: 0; transition: opacity .25s; pointer-events: none; max-width: calc(100% - 32px); }
    #cs-toast.on { opacity: 1; } #cs-toast.bad { background: #9A2A0A; }`;
  document.head.appendChild(css);
  document.body.classList.add("cs-editing");

  const ch = (D.chapters || []).find((c) => c.id === document.body.dataset.page);
  const page = ch ? ch.label : "this page";
  const bar = document.createElement("div");
  bar.id = "cs-editbar";
  bar.innerHTML = `<b>Editing copy${D.demo ? " (demo)" : ""}</b><span class="grow">Click any outlined text on “${page}” to change it.</span>
    <button class="ghost" data-restore disabled>Original wording</button><button class="ghost" data-exit>Exit</button><button class="save" data-save disabled>Save</button>`;
  document.body.appendChild(bar);
  const toast = (msg, bad) => {
    let t = $("#cs-toast"); if (!t) { t = document.createElement("div"); t.id = "cs-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("on");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), bad ? 6000 : 2400);
  };
  const status = () => {
    const n = changed.size;
    $(".grow", bar).textContent = n ? `${n} unsaved change${n === 1 ? "" : "s"}.` : `Click any outlined text on “${page}” to change it.`;
    $("[data-save]", bar).disabled = !n;
  };

  let focused = null;
  const restoreBtn = $("[data-restore]", bar);
  const track = (el) => {
    const k = el.dataset.copy, v = S.cleanCopy(el.innerHTML);
    if (v === base[k]) changed.delete(k); else changed.set(k, v === S.cleanCopy(ORIG[k] || "") ? null : v);
    el.classList.toggle("cs-changed", changed.has(k));
    status();
  };
  els.forEach((el) => {
    el.contentEditable = "true";
    el.spellcheck = true;
    el.addEventListener("input", () => track(el));
    el.addEventListener("focus", () => { focused = el; restoreBtn.disabled = S.cleanCopy(el.innerHTML) === S.cleanCopy(ORIG[el.dataset.copy] || ""); });
    el.addEventListener("blur", () => { el.innerHTML = S.cleanCopy(el.innerHTML) || el.innerHTML; });
    el.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain")); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); } });
  });
  restoreBtn.onmousedown = (e) => e.preventDefault(); // keep focus on the text
  restoreBtn.onclick = () => {
    if (!focused) return;
    focused.innerHTML = ORIG[focused.dataset.copy] || "";
    track(focused); restoreBtn.disabled = true;
  };

  // links and buttons don't navigate or submit while editing their wording
  document.addEventListener("click", (e) => {
    if (e.target.closest("#cs-editbar")) return;
    const t = e.target.closest("a, button");
    if (t && (t.closest("[data-copy]") || t.querySelector("[data-copy]"))) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("submit", (e) => e.preventDefault(), true);
  addEventListener("beforeunload", (e) => { if (changed.size) { e.preventDefault(); e.returnValue = ""; } });

  const exitUrl = () => { const u = new URL(location.href); u.searchParams.delete("edit"); u.searchParams.set("fresh", "1"); return u.pathname + u.search + u.hash; };
  $("[data-exit]", bar).onclick = () => {
    if (changed.size && !confirm("Leave without saving your changes?")) return;
    changed.clear(); location.href = exitUrl();
  };

  const merge = (copy) => {
    const next = Object.assign({}, copy || {});
    changed.forEach((v, k) => { if (v === null) delete next[k]; else next[k] = v; });
    return next;
  };

  let sb = null;
  const loadLib = () => new Promise((ok, no) => {
    if (window.supabase) return ok(window.supabase);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
    s.onload = () => ok(window.supabase); s.onerror = () => no(new Error("Couldn't load the sign-in library. Check your connection."));
    document.head.appendChild(s);
  });
  async function saveLive() {
    if (!CFG.url || !CFG.key) throw new Error("Supabase isn't set up in js/data.js.");
    if (!sb) sb = (await loadLib()).createClient(CFG.url, CFG.key, { auth: { persistSession: true } });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error("You're not signed in. Sign in on the admin page first, then come back.");
    const { data: ok } = await sb.rpc("is_admin");
    if (!ok) throw new Error("This account isn't an admin.");
    const { data: row, error } = await sb.from("site_content").select("data").eq("id", "site").maybeSingle();
    if (error) throw error;
    const data = Object.assign({}, (row && row.data) || {});
    data.copy = merge(data.copy);
    const up = await sb.from("site_content").upsert({ id: "site", data, updated_at: new Date().toISOString(), updated_by: session.user.id });
    if (up.error) throw up.error;
    try { sessionStorage.removeItem("cs-live-cache"); } catch (_) {}
  }
  function saveDemo() {
    const st = S.read() || S.seed();
    st.site = st.site || {};
    st.site.copy = merge(st.site.copy);
    if (!S.write(st)) throw new Error("This browser's storage is full.");
  }
  $("[data-save]", bar).onclick = async () => {
    const btn = $("[data-save]", bar); btn.disabled = true;
    try {
      if (D.demo) saveDemo(); else await saveLive();
      changed.forEach((v, k) => { base[k] = v === null ? S.cleanCopy(ORIG[k] || "") : v; if (v === null) delete stored[k]; else stored[k] = v; });
      els.forEach((el) => el.classList.remove("cs-changed"));
      changed.clear(); status();
      toast(D.demo ? "Saved in this browser (demo)." : "Saved. Visitors see the new wording now.");
    } catch (err) { console.error(err); toast(err.message || String(err), true); status(); }
  };
  status();
})();
