/* Clicksyde admin panel (admin.html).

   Two modes:
   - Demo: no sign-in. Everything is saved in this browser (localStorage) and shown on the site via ?demo=1.
     Good for walkthroughs; nobody else sees the changes.
   - Live: sign in with a Supabase account listed in public.admins. Changes are saved to the Clicksyde
     Supabase project and every visitor sees them. Needs supabase/migrations/20261126000000_clicksyde_admin.sql.

   Sections: Overview, Leads, Newsletter, Blog, Client logos, Contact & social, Layout & brand. */
(function () {
  const S = window.CSstore, D0 = S.defaults, CFG = window.CS.supabase || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const nowIso = () => new Date().toISOString();
  const app = $("#app");
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (_) {} }
  };

  let api = null, mode = null, user = null, sb = null;

  /* ---------- Small helpers ---------- */
  let toastTimer;
  const toast = (msg, bad) => {
    const t = $(".toast");
    t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), bad ? 6000 : 2600);
  };
  const fail = (e) => { console.error(e); toast(friendly(e), true); };
  const friendly = (e) => {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/relation .* does not exist|Could not find the table/i.test(m)) return "The database isn't set up for the admin yet. Run supabase/migrations/20261126000000_clicksyde_admin.sql on the Clicksyde project.";
    if (/row-level security|permission denied/i.test(m)) return "Your account isn't allowed to change this. Ask for it to be added to the admins table.";
    return m;
  };
  const when = (iso) => {
    const d = new Date(iso); if (isNaN(d)) return "";
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " h ago";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + " d ago";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  const slugify = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "article";
  const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c);
  const csv = (rows, name) => {
    const text = rows.map((r) => r.map((v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const readFile = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  const withDefaults = (d) => {
    d = d || {};
    return {
      contact: Object.assign(clone(D0.contact), d.contact || {}),
      clients: Array.isArray(d.clients) ? d.clients : clone(D0.clients),
      layout: d.layout && Array.isArray(d.layout.home) ? d.layout : clone(D0.layout),
      theme: d.theme && isHex(d.theme.brand) ? d.theme : { brand: "#FF4306" },
      services: Array.isArray(d.services) && d.services.length ? d.services : clone(D0.services),
      problems: Array.isArray(d.problems) ? d.problems : clone(D0.problems),
      postsManaged: !!d.postsManaged
    };
  };
  const starterPosts = () => D0.posts.map((p, i) => ({
    id: p.id, title: p.title, cat: p.cat, ex: p.ex, body: p.body || [], color: p.color, art: p.art, image_url: "",
    mins: p.mins, featured: !!p.featured, published: true, published_at: new Date(Date.now() - (3 + i * 4) * 864e5).toISOString()
  }));

  /* ---------- Back ends ---------- */
  const demoApi = {
    s() { let s = S.read(); if (!s) { s = S.seed(); S.write(s); } return s; },
    w(s) { if (!S.write(s)) throw new Error("This browser's storage is full. Use a smaller image, or reset the demo."); },
    async getSite() { return withDefaults(this.s().site); },
    async saveSite(site) { const s = this.s(); s.site = site; this.w(s); },
    async listPosts() { return this.s().posts.slice().sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0)); },
    async savePost(p, isNew) {
      const s = this.s();
      if (isNew && s.posts.some((x) => x.id === p.id)) throw new Error("An article with that web address already exists. Change the slug.");
      p = Object.assign({}, p, { updated_at: nowIso() });
      if (isNew) p.created_at = nowIso();
      if (p.published && !p.published_at) p.published_at = nowIso();
      if (p.featured) s.posts.forEach((x) => { x.featured = false; });
      const i = s.posts.findIndex((x) => x.id === p.id);
      if (i < 0) s.posts.unshift(p); else s.posts[i] = p;
      this.w(s); return p;
    },
    async deletePost(id) { const s = this.s(); s.posts = s.posts.filter((x) => x.id !== id); this.w(s); },
    async importStarters() {},
    async listLeads() { return this.s().leads.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
    async updateLead(id, patch) { const s = this.s(); Object.assign(s.leads.find((x) => x.id === id), patch); this.w(s); },
    async listSubs() { return this.s().subscribers.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
    async updateSub(id, patch) { const s = this.s(); Object.assign(s.subscribers.find((x) => x.id === id), patch); this.w(s); },
    async upload(file) {
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG, JPG, WebP, GIF or SVG image.");
      if (file.size > 400 * 1024) throw new Error("In demo mode images must be under 400 KB (the live admin takes up to 5 MB).");
      return readFile(file);
    },
    link: (path) => path + "?demo=1"
  };

  const liveApi = {
    async getSite() {
      const { data, error } = await sb.from("site_content").select("data").eq("id", "site").maybeSingle();
      if (error) throw error;
      return withDefaults(data && data.data);
    },
    async saveSite(site) {
      const { error } = await sb.from("site_content").upsert({ id: "site", data: site, updated_at: nowIso(), updated_by: user.id });
      if (error) throw error;
    },
    async listPosts() {
      const { data, error } = await sb.from("posts").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    async savePost(p, isNew) {
      const row = { id: p.id, title: p.title, cat: p.cat, ex: p.ex, body: p.body, color: p.color, art: p.art, image_url: p.image_url || null, mins: p.mins, featured: p.featured, published: p.published };
      if (!p.published) row.published_at = null;
      if (p.featured) { const r = await sb.from("posts").update({ featured: false }).eq("featured", true).neq("id", p.id); if (r.error) throw r.error; }
      const q = isNew ? sb.from("posts").insert(row) : sb.from("posts").update(row).eq("id", p.id);
      const { data, error } = await q.select().single();
      if (error) throw (error.code === "23505" ? new Error("An article with that web address already exists. Change the slug.") : error);
      return data;
    },
    async deletePost(id) { const { error } = await sb.from("posts").delete().eq("id", id); if (error) throw error; },
    async importStarters() {
      const rows = starterPosts().map((p) => Object.assign(p, { image_url: null }));
      const { error } = await sb.from("posts").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },
    async listLeads() { const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false }).limit(1000); if (error) throw error; return data; },
    async updateLead(id, patch) { const { error } = await sb.from("leads").update(patch).eq("id", id); if (error) throw error; },
    async listSubs() { const { data, error } = await sb.from("subscribers").select("*").order("created_at", { ascending: false }).limit(5000); if (error) throw error; return data; },
    async updateSub(id, patch) { const { error } = await sb.from("subscribers").update(patch).eq("id", id); if (error) throw error; },
    async upload(file, folder) {
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG, JPG, WebP, GIF or SVG image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB.");
      const name = `${folder}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60)}`;
      const { error } = await sb.storage.from("media").upload(name, file, { contentType: file.type });
      if (error) throw error;
      return sb.storage.from("media").getPublicUrl(name).data.publicUrl;
    },
    link: (path) => path + "?fresh=1"
  };

  /* ---------- Sign-in ---------- */
  const loadSupabase = () => new Promise((ok, no) => {
    if (window.supabase) return ok(window.supabase);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
    s.onload = () => ok(window.supabase); s.onerror = () => no(new Error("Couldn't load the sign-in library. Check your connection and try again."));
    document.head.appendChild(s);
  });
  const liveReady = !!(CFG.url && CFG.key);
  async function client() {
    if (sb) return sb;
    const lib = await loadSupabase();
    sb = lib.createClient(CFG.url, CFG.key, { auth: { persistSession: true, detectSessionInUrl: true } });
    return sb;
  }

  function loginScreen(msg) {
    app.innerHTML = `<div class="login">
      <div class="login-card">
        <div class="adm-brand">${window.CSmarkAdmin()}<span>Clicksyde <b>admin</b></span></div>
        <h1>Sign in</h1>
        <p class="muted">Manage leads, the newsletter, blog articles, client logos, contact links and the home page layout.</p>
        ${msg ? `<p class="note">${esc(msg)}</p>` : ""}
        <form class="login-form" ${liveReady ? "" : "hidden"}>
          <label>Email<input type="email" name="email" autocomplete="username" required></label>
          <label>Password<input type="password" name="password" autocomplete="current-password"></label>
          <button class="btn btn-dark" type="submit">Sign in</button>
          <button class="linkish" type="button" data-magic>No password? Email me a sign-in link</button>
        </form>
        <div class="or"><span>or</span></div>
        <button class="btn btn-brand demo-btn" data-demo>Explore the demo <span class="arr">→</span></button>
        <p class="small muted">The demo needs no account. Changes stay in this browser, and you can preview them on the site.</p>
      </div></div>`;
    $("[data-demo]").onclick = () => { ss.set("cs-admin-mode", "demo"); start("demo"); };
    const form = $(".login-form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = form.email.value.trim(), password = form.password.value;
      if (!password) return toast("Enter your password, or use the sign-in link.", true);
      try {
        await client();
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        start("live");
      } catch (err) { fail(err); }
    };
    $("[data-magic]").onclick = async () => {
      const email = form.email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Type your email first.", true);
      try {
        await client();
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } });
        if (error) throw error;
        toast("Check your inbox for the sign-in link.");
      } catch (err) { fail(err); }
    };
  }

  async function start(m) {
    mode = m;
    if (m === "demo") { api = demoApi; user = { email: "Demo" }; return shell(); }
    try {
      await client();
      const { data } = await sb.auth.getSession();
      if (!data.session) return loginScreen();
      user = data.session.user;
      const { data: ok, error } = await sb.rpc("is_admin");
      if (error) throw error;
      if (!ok) {
        await sb.auth.signOut();
        return loginScreen(`You're signed in as ${user.email}, but that account isn't an admin yet. Ask a Clicksyde admin to add this user id to the admins table in Supabase: ${user.id}`);
      }
      api = liveApi; shell();
    } catch (err) { fail(err); loginScreen(); }
  }

  /* ---------- Shell ---------- */
  const NAV = [
    ["overview", "Overview", "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"],
    ["leads", "Leads", "M4 6h16v12H4zM4 7l8 6 8-6"],
    ["newsletter", "Newsletter", "M5 4h14v16l-7-4-7 4z"],
    ["blog", "Blog", "M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14"],
    ["services", "Services", "M5 4h14v11l-5 5H5zM14 20v-5h5"],
    ["clients", "Client logos", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
    ["contact", "Contact & social", "M21 3 3 10.5l7 2.5 2.5 7zM10 13l4-4"],
    ["layout", "Layout & brand", "M4 4h16v5H4zM4 12h7v8H4zM14 12h6v8h-6z"]
  ];
  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  function shell() {
    app.innerHTML = `<div class="adm-shell">
      <aside class="adm-side">
        <a class="adm-brand" href="#overview">${window.CSmarkAdmin()}<span>Clicksyde <b>admin</b></span></a>
        <nav>${NAV.map(([id, t, d]) => `<a href="#${id}" data-nav="${id}">${icon(d)}<span>${t}</span></a>`).join("")}</nav>
        <div class="side-foot">
          ${mode === "demo"
            ? `<span class="mode demo">Demo mode</span><p>Changes stay in this browser.</p><button class="linkish" data-reset>Reset demo</button> · <button class="linkish" data-signout>Leave demo</button>`
            : `<span class="mode live">Live</span><p>${esc(user.email)}</p><button class="linkish" data-signout>Sign out</button>`}
        </div>
      </aside>
      <main class="adm-main"><div class="adm-view"></div></main></div>`;
    $("[data-signout]").onclick = async () => {
      ss.del("cs-admin-mode");
      if (mode === "live" && sb) await sb.auth.signOut();
      location.hash = ""; loginScreen();
    };
    const reset = $("[data-reset]");
    if (reset) reset.onclick = () => {
      if (!confirm("Reset the demo? This clears every change made in demo mode in this browser.")) return;
      S.reset(); toast("Demo reset to the starting content."); route();
    };
    route();
  }

  const view = () => $(".adm-view");
  const head = (title, sub, actions = "") => `<div class="v-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div><div class="v-acts">${actions}</div></div>`;
  const siteLink = (path, label = "View on site") => `<a class="btn btn-light" href="${esc(api.link(path))}" target="_blank" rel="noopener">${label} ↗</a>`;

  async function route() {
    if (!api) return;
    const [sec, arg] = (location.hash.slice(1) || "overview").split("/");
    $$("[data-nav]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.nav === sec));
    const v = view(); if (!v) return;
    v.innerHTML = `<p class="muted loading">Loading…</p>`;
    try {
      if (sec === "leads") await leads(arg);
      else if (sec === "newsletter") await newsletter();
      else if (sec === "blog") arg ? await editor(decodeURIComponent(arg)) : await blog();
      else if (sec === "services") arg ? await serviceEditor(decodeURIComponent(arg)) : await services();
      else if (sec === "clients") await clients();
      else if (sec === "contact") await contact();
      else if (sec === "layout") await layout();
      else await overview();
    } catch (err) { v.innerHTML = head("Something went wrong") + `<p class="note">${esc(friendly(err))}</p>`; console.error(err); }
    window.scrollTo(0, 0);
  }
  addEventListener("hashchange", route);

  /* ---------- Overview ---------- */
  async function overview() {
    const [ls, subs, posts] = await Promise.all([api.listLeads(), api.listSubs(), api.listPosts()]);
    const fresh = ls.filter((l) => l.status === "new").length;
    const month = ls.filter((l) => Date.now() - new Date(l.created_at) < 30 * 864e5).length;
    const active = subs.filter((s) => !s.unsubscribed_at).length;
    const live = posts.filter((p) => p.published).length;
    view().innerHTML = head("Overview", mode === "demo" ? "You're in demo mode. Try sending the “Let's talk” form on the demo site: it lands in Leads here." : "What's happening on clicksyde.com.",
      siteLink("index.html", "View site")) + `
      <div class="stats">
        <a class="stat" href="#leads"><b>${fresh}</b><span>new lead${fresh === 1 ? "" : "s"} to answer</span></a>
        <a class="stat" href="#leads"><b>${month}</b><span>leads in the last 30 days</span></a>
        <a class="stat" href="#newsletter"><b>${active}</b><span>newsletter subscriber${active === 1 ? "" : "s"}</span></a>
        <a class="stat" href="#blog"><b>${live}</b><span>published article${live === 1 ? "" : "s"}</span></a>
      </div>
      <div class="panel"><div class="panel-head"><h2>Latest leads</h2><a href="#leads">All leads →</a></div>
        ${ls.length ? `<ul class="list">${ls.slice(0, 5).map((l) => `<li><a href="#leads/${esc(l.id)}"><b>${esc(l.name)}</b> <span class="muted">· ${esc(l.business)}</span><span class="pill s-${slugify(l.status)}">${esc(l.status)}</span><span class="muted r">${when(l.created_at)}</span></a></li>`).join("")}</ul>`
          : `<p class="muted">No leads yet. They appear here as soon as someone finishes the “Let's talk” form.</p>`}
      </div>
      <div class="quick">
        <a class="q" href="#blog/new"><b>Write an article</b><span>Publish to Insights</span></a>
        <a class="q" href="#clients"><b>Update client logos</b><span>The slideshow on the home page</span></a>
        <a class="q" href="#layout"><b>Change the home layout</b><span>Reorder or hide sections, brand colour</span></a>
      </div>`;
  }

  /* ---------- Leads ---------- */
  const STATUSES = ["new", "contacted", "call booked", "proposal sent", "won", "lost"];
  async function leads(openId) {
    const all = await api.listLeads();
    let filter = ss.get("cs-lead-filter") || "all";
    const draw = () => {
      const rows = filter === "all" ? all : all.filter((l) => l.status === filter);
      view().innerHTML = head("Leads", "Everyone who finished the “Let's talk” form. Update the status as the conversation moves.",
        `<button class="btn btn-light" data-export ${all.length ? "" : "disabled"}>Export CSV</button>`) + `
        <div class="chips">${["all", ...STATUSES].map((s) => `<button class="chip" data-f="${s}" aria-pressed="${s === filter}">${s === "all" ? "All" : s} <span>${s === "all" ? all.length : all.filter((l) => l.status === s).length}</span></button>`).join("")}</div>
        ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Who</th><th>Needs</th><th>Budget</th><th>Timeline</th><th>Status</th><th>Received</th></tr></thead><tbody>
          ${rows.map((l) => `<tr data-id="${esc(l.id)}" tabindex="0"><td><b>${esc(l.name)}</b><br><span class="muted">${esc(l.business)}</span></td>
            <td>${esc((l.needs || []).join(", "))}${l.service ? `<br><span class="muted">From: ${esc(l.service)}</span>` : ""}</td>
            <td>${esc(l.budget)}</td><td>${esc(l.timeline)}</td><td><span class="pill s-${slugify(l.status)}">${esc(l.status)}</span></td><td class="muted">${when(l.created_at)}</td></tr>`).join("")}
          </tbody></table></div>` : `<p class="muted empty">No leads ${filter === "all" ? "yet" : "with this status"}.</p>`}
        <div class="drawer" hidden></div>`;
      $$("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; ss.set("cs-lead-filter", filter); draw(); }));
      $$("tr[data-id]").forEach((tr) => {
        tr.onclick = () => openLead(tr.dataset.id);
        tr.onkeydown = (e) => { if (e.key === "Enter") openLead(tr.dataset.id); };
      });
      $("[data-export]").onclick = () => csv([["Received", "Name", "Business", "Needs", "From service", "Budget", "Timeline", "Contact", "About", "Status", "Notes"],
        ...all.map((l) => [l.created_at, l.name, l.business, (l.needs || []).join("; "), l.service, l.budget, l.timeline, l.contact, l.about, l.status, l.notes])], "clicksyde-leads.csv");
    };
    const openLead = (id) => {
      const l = all.find((x) => x.id === id); if (!l) return;
      history.replaceState(null, "", "#leads/" + encodeURIComponent(id));
      const digits = String(l.contact || "").replace(/\D/g, "");
      const email = /@/.test(l.contact || "");
      const wa = digits.length >= 10 ? (digits.startsWith("0") ? "234" + digits.slice(1) : digits) : "";
      const d = $(".drawer");
      d.innerHTML = `<div class="drawer-card" role="dialog" aria-modal="true" aria-label="Lead from ${esc(l.name)}">
        <button class="x" aria-label="Close">✕</button>
        <span class="muted small">${new Date(l.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
        <h2>${esc(l.name)}</h2><p class="muted" style="margin-top:-6px">${esc(l.business)}</p>
        <div class="reach">${email ? `<a class="btn btn-dark" href="mailto:${esc(l.contact)}?subject=${encodeURIComponent("Your Clicksyde enquiry")}">Email ${esc(l.contact)}</a>` : ""}
          ${wa ? `<a class="btn btn-dark" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn-light" href="tel:${esc(l.contact)}">Call ${esc(l.contact)}</a>` : ""}
          ${!email && !wa ? `<span>${esc(l.contact)}</span>` : ""}</div>
        <dl><dt>Needs</dt><dd>${esc((l.needs || []).join(", "))}</dd>
          ${l.service ? `<dt>Came from</dt><dd>${esc(l.service)} (on The Wall)</dd>` : ""}
          <dt>Budget</dt><dd>${esc(l.budget)}</dd><dt>Timeline</dt><dd>${esc(l.timeline)}</dd>
          ${l.about ? `<dt>About them</dt><dd>${esc(l.about)}</dd>` : ""}</dl>
        <label>Status<select name="status">${STATUSES.map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Notes for the team<textarea name="notes" rows="4" placeholder="e.g. Call booked for Tuesday 10am">${esc(l.notes || "")}</textarea></label>
        <div class="row-end"><button class="btn btn-brand" data-save>Save</button></div></div>`;
      d.hidden = false;
      const close = () => { d.hidden = true; history.replaceState(null, "", "#leads"); };
      $(".x", d).onclick = close;
      d.onclick = (e) => { if (e.target === d) close(); };
      d.onkeydown = (e) => { if (e.key === "Escape") close(); };
      $("select", d).focus();
      $("[data-save]", d).onclick = async () => {
        const patch = { status: $("select", d).value, notes: $("textarea", d).value.trim() || null };
        try { await api.updateLead(l.id, patch); Object.assign(l, patch); toast("Lead updated."); close(); draw(); } catch (err) { fail(err); }
      };
    };
    draw();
    if (openId) openLead(decodeURIComponent(openId));
  }

  /* ---------- Newsletter ---------- */
  async function newsletter() {
    const all = await api.listSubs();
    const draw = () => {
      const active = all.filter((s) => !s.unsubscribed_at);
      view().innerHTML = head("Newsletter", `${active.length} active subscriber${active.length === 1 ? "" : "s"} to The Syde Note. Export the list to send it from your email tool.`,
        `<button class="btn btn-light" data-export ${active.length ? "" : "disabled"}>Export active (CSV)</button>`) +
        (all.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Signed up on</th><th>When</th><th></th></tr></thead><tbody>
          ${all.map((s) => `<tr><td>${esc(s.email)}${s.unsubscribed_at ? ` <span class="pill s-lost">unsubscribed</span>` : ""}</td><td class="muted">${esc(s.source || "")}</td><td class="muted">${when(s.created_at)}</td>
            <td class="r"><button class="linkish" data-toggle="${esc(s.id)}">${s.unsubscribed_at ? "Resubscribe" : "Unsubscribe"}</button></td></tr>`).join("")}
          </tbody></table></div>` : `<p class="muted empty">No subscribers yet. Sign-ups from the Insights page appear here.</p>`);
      $("[data-export]").onclick = () => csv([["Email", "Signed up", "Source"], ...active.map((s) => [s.email, s.created_at, s.source])], "clicksyde-newsletter.csv");
      $$("[data-toggle]").forEach((b) => (b.onclick = async () => {
        const s = all.find((x) => x.id === b.dataset.toggle);
        const patch = { unsubscribed_at: s.unsubscribed_at ? null : nowIso() };
        try { await api.updateSub(s.id, patch); Object.assign(s, patch); draw(); } catch (err) { fail(err); }
      }));
    };
    draw();
  }

  /* ---------- Blog ---------- */
  async function blog() {
    const [posts, site] = await Promise.all([api.listPosts(), api.getSite()]);
    const unmanaged = mode === "live" && !site.postsManaged;
    view().innerHTML = head("Blog", "Articles on the Insights page. Drafts stay hidden until you publish them.",
      unmanaged ? "" : `${siteLink("insights.html")}<a class="btn btn-brand" href="#blog/new">New article</a>`) +
      (unmanaged ? `<div class="panel callout"><h2>Start managing the blog here</h2>
        <p>The Insights page is currently showing the ${D0.posts.length} starter articles from the website's code. Import them to edit them here, or start with an empty blog.</p>
        <div class="row"><button class="btn btn-brand" data-import>Import the ${D0.posts.length} starter articles</button><button class="btn btn-light" data-empty>Start empty</button></div></div>` : "") +
      (posts.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Article</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead><tbody>
        ${posts.map((p) => `<tr data-href="#blog/${encodeURIComponent(p.id)}" tabindex="0"><td><span class="swatch" style="background:${isHex(p.color) ? p.color : "#161616"}"></span><b>${esc(p.title)}</b>${p.featured ? ` <span class="pill s-featured">featured</span>` : ""}<br><span class="muted small">insights.html#${esc(p.id)}</span></td>
          <td>${esc(p.cat)}</td><td><span class="pill ${p.published ? "s-won" : "s-draft"}">${p.published ? "published" : "draft"}</span></td><td class="muted">${when(p.updated_at || p.published_at || p.created_at)}</td></tr>`).join("")}
        </tbody></table></div>` : unmanaged ? "" : `<p class="muted empty">No articles yet. <a href="#blog/new">Write the first one.</a></p>`);
    $$("tr[data-href]").forEach((tr) => { tr.onclick = () => (location.hash = tr.dataset.href); tr.onkeydown = (e) => { if (e.key === "Enter") location.hash = tr.dataset.href; }; });
    const imp = $("[data-import]"), empty = $("[data-empty]");
    const manage = async (importing) => {
      try {
        if (importing) await api.importStarters();
        await api.saveSite(Object.assign(site, { postsManaged: true }));
        toast(importing ? "Starter articles imported." : "The blog is now managed here."); route();
      } catch (err) { fail(err); }
    };
    if (imp) imp.onclick = () => manage(true);
    if (empty) empty.onclick = () => { if (confirm("The Insights page will be empty until you publish an article. Continue?")) manage(false); };
  }

  const toText = (body) => (body || []).map(([t, x]) => (t === "h" ? "## " + x : t === "q" ? "> " + x : x)).join("\n\n");
  const fromText = (text) => text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) =>
    b.startsWith("## ") ? ["h", b.slice(3).trim()] : b.startsWith("> ") ? ["q", b.slice(2).replace(/\n>\s?/g, " ").trim()] : ["p", b.replace(/\s*\n\s*/g, " ")]);
  const COLORS = ["#FF4306", "#161616", "#2B6CB0", "#26B3A6", "#F6A8C5", "#C9B6F2", "#FFE45C", "#00B8E6"];

  async function editor(id) {
    const posts = await api.listPosts();
    const isNew = id === "new";
    const found = posts.find((p) => p.id === id);
    if (!isNew && !found) { view().innerHTML = head("Article not found") + `<p><a href="#blog">← Back to the blog</a></p>`; return; }
    const p = isNew ? { id: "", title: "", cat: "Strategy", ex: "", body: [], color: "#FF4306", art: "", image_url: "", mins: 3, featured: false, published: false } : clone(found);
    const cats = [...new Set(posts.map((x) => x.cat).concat(["Strategy", "Content", "Performance", "Brand"]))];
    let slugTouched = !isNew;
    view().innerHTML = head(isNew ? "New article" : "Edit article", `<a href="#blog">← All articles</a>`,
      !isNew && p.published ? siteLink(`insights.html#${p.id}`) : "") + `
      <form class="editor">
        <div class="ed-main">
          <label>Title<input name="title" required maxlength="200" value="${esc(p.title)}" placeholder="e.g. Three numbers to check every Monday"></label>
          <label>Web address <span class="muted">(insights.html#…)</span><input name="id" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(p.id)}" ${isNew ? "" : "readonly"} title="Lowercase letters, numbers and dashes"></label>
          <label>Short summary <span class="muted">(shown on the card)</span><textarea name="ex" rows="2" maxlength="400">${esc(p.ex)}</textarea></label>
          <label>Article
            <textarea name="body" rows="18" class="mono" placeholder="Write in plain paragraphs, with an empty line between them.">${esc(toText(p.body))}</textarea></label>
          <p class="small muted">Leave an empty line between paragraphs. Start a line with <code>## </code> for a heading and <code>&gt; </code> for a pull quote.</p>
        </div>
        <div class="ed-side">
          <div class="panel">
            <h3>Publishing</h3>
            <label class="switch"><input type="checkbox" name="published" ${p.published ? "checked" : ""}><span>Published</span></label>
            <label class="switch"><input type="checkbox" name="featured" ${p.featured ? "checked" : ""}><span>Featured at the top of Insights</span></label>
            <label>Category<input name="cat" list="cats" required maxlength="40" value="${esc(p.cat)}"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
            <p class="small muted mins"></p>
          </div>
          <div class="panel">
            <h3>Cover</h3>
            <div class="cover-preview"></div>
            <div class="swatches">${COLORS.map((c) => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")}<input type="color" name="color" value="${isHex(p.color) ? p.color : "#FF4306"}" aria-label="Custom colour"></div>
            <label>Cover text <span class="muted">(a few characters, e.g. ★★★★★)</span><input name="art" maxlength="24" value="${esc(p.art)}"></label>
            <div class="row"><label class="btn btn-light file">Upload cover image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>
              <button type="button" class="linkish" data-noimg ${p.image_url ? "" : "hidden"}>Remove image</button></div>
          </div>
          <div class="row-end">${isNew ? "" : `<button type="button" class="btn btn-ghost danger" data-del>Delete</button>`}<button class="btn btn-brand" type="submit">${isNew ? "Save article" : "Save changes"}</button></div>
        </div>
      </form>`;
    const f = $(".editor");
    const preview = () => {
      const c = f.color.value;
      $(".cover-preview").innerHTML = `<div class="post-card"><div class="art" style="background:${isHex(c) ? c : "#161616"}">${p.image_url ? `<img src="${esc(S.imgSrc(p.image_url, true))}" alt="">` : esc(f.art.value || "Aa")}</div>
        <div class="txt"><span class="cat">${esc(f.cat.value)}</span><b>${esc(f.title.value || "Your title")}</b><span class="muted">${esc(f.ex.value)}</span></div></div>`;
      const words = (f.title.value + " " + f.body.value).trim().split(/\s+/).filter(Boolean).length;
      p.mins = Math.max(1, Math.round(words / 220));
      $(".mins").textContent = `${words} words · about ${p.mins} min read`;
    };
    f.title.oninput = () => { if (!slugTouched) f.id.value = slugify(f.title.value); preview(); };
    f.id.oninput = () => { slugTouched = true; };
    ["ex", "art", "cat", "color", "body"].forEach((n) => f[n].addEventListener("input", preview));
    $$(".sw").forEach((b) => (b.onclick = () => { f.color.value = b.dataset.c; preview(); }));
    $(".file input").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { p.image_url = await api.upload(file, "blog"); $("[data-noimg]").hidden = false; preview(); toast("Cover image added. Save to keep it."); } catch (err) { fail(err); }
      e.target.value = "";
    };
    $("[data-noimg]").onclick = () => { p.image_url = ""; $("[data-noimg]").hidden = true; preview(); };
    const del = $("[data-del]");
    if (del) del.onclick = async () => {
      if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
      try { await api.deletePost(p.id); toast("Article deleted."); location.hash = "#blog"; } catch (err) { fail(err); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const body = fromText(f.body.value);
      if (f.published.checked && !body.length) return toast("Write the article before publishing it, or save it as a draft.", true);
      Object.assign(p, { id: f.id.value.trim(), title: f.title.value.trim(), cat: f.cat.value.trim(), ex: f.ex.value.trim(), body,
        color: isHex(f.color.value) ? f.color.value : "#FF4306", art: f.art.value.trim(), published: f.published.checked, featured: f.featured.checked });
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) return toast("The web address can only use lowercase letters, numbers and dashes.", true);
      try {
        if (mode === "live" && isNew) {
          // First article written here: bring the starter articles along so they don't vanish from Insights.
          const site = await api.getSite();
          if (!site.postsManaged) { await api.importStarters(); await api.saveSite(Object.assign(site, { postsManaged: true })); }
        }
        await api.savePost(p, isNew);
        toast(p.published ? "Saved and live on Insights." : "Draft saved.");
        location.hash = "#blog/" + encodeURIComponent(p.id);
        if (!isNew) route();
      } catch (err) { fail(err); }
    };
    preview();
  }

  /* ---------- Services (sticky notes on The Wall) ---------- */
  const NOTE_COLORS = ["#DDE3F6", "#FFE600", "#DDF3E2", "#D8BDF0", "#E3EEF8", "#FDE3EA", "#11C5F0", "#2CB8AD", "#FFB38A", "#F6A8C5"];
  const lines = (t) => t.split("\n").map((x) => x.trim()).filter(Boolean);

  async function services() {
    const site = await api.getSite();
    const list = site.services;
    const save = async (msg) => {
      try { await api.saveSite(site); toast(msg); draw(); } catch (err) { fail(err); }
    };
    const draw = () => {
      view().innerHTML = head("Services", "The sticky notes on The Wall, in this order. Visitors tap a note to read the full service.",
        `${siteLink("services.html")}<a class="btn btn-brand" href="#services/new">New service</a>`) + `
        <ul class="notes-admin">${list.map((s, i) => {
          const fixes = site.problems.filter((p) => p.ids.includes(s.id)).map((p) => p.h);
          return `<li><div class="mini-note" style="background:${isHex(s.c) ? s.c : "#DDE3F6"}"><span>${String(i + 1).padStart(2, "0")}</span><b>${esc(s.t)}</b></div>
            <div class="grow"><b>${esc(s.t)}</b><p class="muted small">${esc(s.s)}</p>
              <p class="small">${fixes.length ? `Fixes: ${fixes.map(esc).join(", ")}` : `<span class="muted">Not linked to any problem in the finder</span>`}</p></div>
            <div class="moves"><a class="btn btn-light" href="#services/${encodeURIComponent(s.id)}">Edit</a>
              <button class="icon-btn" data-up="${i}" aria-label="Move ${esc(s.t)} up" ${i === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-btn" data-down="${i}" aria-label="Move ${esc(s.t)} down" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
              <button class="icon-btn danger" data-rm="${i}" aria-label="Delete ${esc(s.t)}" ${list.length === 1 ? "disabled" : ""}>✕</button></div></li>`;
        }).join("")}</ul>
        <p class="small muted">Reordering and deleting save straight away.</p>`;
      $$("[data-up]").forEach((b) => (b.onclick = () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; save("Order saved."); }));
      $$("[data-down]").forEach((b) => (b.onclick = () => { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; save("Order saved."); }));
      $$("[data-rm]").forEach((b) => (b.onclick = () => {
        const i = +b.dataset.rm, s = list[i];
        if (!confirm(`Delete “${s.t}” from The Wall? Links to services.html#${s.id} will open The Wall without it.`)) return;
        list.splice(i, 1);
        site.problems.forEach((p) => { p.ids = p.ids.filter((x) => x !== s.id); });
        save("Service deleted.");
      }));
    };
    draw();
  }

  async function serviceEditor(id) {
    const site = await api.getSite();
    const isNew = id === "new";
    const found = site.services.find((s) => s.id === id);
    if (!isNew && !found) { view().innerHTML = head("Service not found") + `<p><a href="#services">← Back to services</a></p>`; return; }
    const s = isNew
      ? { id: "", t: "", s: "", body: "", c: NOTE_COLORS[site.services.length % NOTE_COLORS.length], rot: site.services.length % 2 ? -1.5 : 1.5, cat: "show", get: [], for: [] }
      : clone(found);
    let slugTouched = !isNew;
    view().innerHTML = head(isNew ? "New service" : "Edit service", `<a href="#services">← All services</a>`, isNew ? "" : siteLink(`services.html#${s.id}`)) + `
      <form class="editor">
        <div class="ed-main">
          <label>Service name<input name="t" required maxlength="80" value="${esc(s.t)}" placeholder="e.g. Email Marketing"></label>
          <label>Web address <span class="muted">(services.html#… and the “I need this” button)</span><input name="id" required maxlength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(s.id)}" ${isNew ? "" : "readonly"} title="Lowercase letters, numbers and dashes"></label>
          <label>One-liner <span class="muted">(on the sticky note)</span><input name="s" required maxlength="200" value="${esc(s.s)}"></label>
          <label>What it is <span class="muted">(shown when the note opens)</span><textarea name="body" rows="5" maxlength="2000">${esc(s.body)}</textarea></label>
          <div class="two-col">
            <label>What you get <span class="muted">(one per line)</span><textarea name="get" rows="6">${esc(s.get.join("\n"))}</textarea></label>
            <label>Great for <span class="muted">(one per line)</span><textarea name="for" rows="6">${esc(s.for.join("\n"))}</textarea></label>
          </div>
        </div>
        <div class="ed-side">
          <div class="panel"><h3>Sticky note</h3>
            <div class="note-preview"></div>
            <div class="swatches">${NOTE_COLORS.map((c) => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")}<input type="color" name="c" value="${isHex(s.c) ? s.c : "#DDE3F6"}" aria-label="Custom colour"></div>
          </div>
          <div class="panel"><h3>Problem finder</h3><p class="small muted" style="margin:0">Which problems on The Wall does this service fix? Picking a problem there lights up these notes.</p>
            ${site.problems.map((p, i) => `<label class="switch"><input type="checkbox" name="prob" value="${i}" ${s.id && p.ids.includes(s.id) ? "checked" : ""}><span>${esc(p.p)} <span class="muted small">${esc(p.h)}</span></span></label>`).join("")}
          </div>
          <div class="row-end"><button class="btn btn-brand" type="submit">${isNew ? "Add to The Wall" : "Save changes"}</button></div>
        </div>
      </form>`;
    const f = $(".editor");
    const preview = () => {
      $(".note-preview").innerHTML = `<div class="mini-note big" style="background:${isHex(f.c.value) ? f.c.value : "#DDE3F6"};transform:rotate(${Number(s.rot) || 0}deg)"><b>${esc(f.t.value || "Service name")}</b><span>${esc(f.s.value || "The one-liner goes here.")}</span></div>`;
    };
    f.t.oninput = () => { if (!slugTouched) f.id.value = slugify(f.t.value).slice(0, 40); preview(); };
    f.id.oninput = () => { slugTouched = true; };
    f.s.oninput = preview; f.c.oninput = preview;
    $$(".sw").forEach((b) => (b.onclick = () => { f.c.value = b.dataset.c; preview(); }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const next = Object.assign(s, { id: f.id.value.trim(), t: f.t.value.trim(), s: f.s.value.trim(), body: f.body.value.trim(),
        c: isHex(f.c.value) ? f.c.value : "#DDE3F6", get: lines(f.get.value), for: lines(f.for.value) });
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(next.id)) return toast("The web address can only use lowercase letters, numbers and dashes.", true);
      if (isNew && site.services.some((x) => x.id === next.id)) return toast("Another service already uses that web address. Change it.", true);
      if (!next.get.length) return toast("Add at least one line under “What you get”.", true);
      const picked = new Set($$("[name=prob]:checked", f).map((c) => +c.value));
      site.problems.forEach((p, i) => {
        p.ids = p.ids.filter((x) => x !== next.id);
        if (picked.has(i)) p.ids.push(next.id);
      });
      if (isNew) site.services.push(next);
      else site.services[site.services.findIndex((x) => x.id === next.id)] = next;
      try { await api.saveSite(site); toast(isNew ? "Added to The Wall." : "Service saved."); location.hash = "#services"; } catch (err) { fail(err); }
    };
    preview();
  }

  /* ---------- Client logos ---------- */
  async function clients() {
    const site = await api.getSite();
    let list = clone(site.clients);
    const draw = () => {
      view().innerHTML = head("Client logos", "Brands in the slideshow on the home page, in this order. Brands without a logo show as text.",
        `${siteLink("index.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
        <div class="strip">${list.map((c) => { const src = S.imgSrc(c.logo, true); return src ? `<img src="${esc(src)}" alt="${esc(c.n)}">` : `<span>${esc(c.n || "Brand")}</span>`; }).join("")}</div>
        <ul class="rows">${list.map((c, i) => { const src = S.imgSrc(c.logo, true); return `<li data-i="${i}">
          <div class="logo-box">${src ? `<img src="${esc(src)}" alt="">` : `<span class="muted small">No logo</span>`}</div>
          <label class="grow">Brand name<input value="${esc(c.n)}" maxlength="80" data-name></label>
          <label class="btn btn-light file">${src ? "Replace logo" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-file></label>
          ${src ? `<button class="linkish" data-nologo>Remove logo</button>` : ""}
          <div class="moves"><button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-down aria-label="Move down" ${i === list.length - 1 ? "disabled" : ""}>↓</button><button class="icon-btn danger" data-rm aria-label="Remove ${esc(c.n)}">✕</button></div>
        </li>`; }).join("")}</ul>
        <button class="btn btn-light" data-add>+ Add a brand</button>
        <p class="small muted">Tip: logos on a transparent background, at least 200px wide, look best. ${mode === "demo" ? "In demo mode logos must be under 400 KB." : "Up to 5 MB each."}</p>`;
      $$("li[data-i]").forEach((li) => {
        const i = +li.dataset.i;
        $("[data-name]", li).oninput = (e) => { list[i].n = e.target.value; };
        $("[data-file]", li).onchange = async (e) => {
          const file = e.target.files[0]; if (!file) return;
          try { list[i].logo = await api.upload(file, "clients"); draw(); toast("Logo added. Save to put it on the site."); } catch (err) { fail(err); }
        };
        const nl = $("[data-nologo]", li); if (nl) nl.onclick = () => { delete list[i].logo; draw(); };
        $("[data-up]", li).onclick = () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); };
        $("[data-down]", li).onclick = () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); };
        $("[data-rm]", li).onclick = () => { list.splice(i, 1); draw(); };
      });
      $("[data-add]").onclick = () => { list.push({ n: "" }); draw(); $$("[data-name]").pop().focus(); };
      $("[data-save]").onclick = async () => {
        list = list.map((c) => Object.assign(c, { n: c.n.trim() })).filter((c) => c.n);
        try { await api.saveSite(Object.assign(site, { clients: list })); toast("Client logos saved."); draw(); } catch (err) { fail(err); }
      };
    };
    draw();
  }

  /* ---------- Contact & social ---------- */
  async function contact() {
    const site = await api.getSite();
    const c = site.contact;
    const val = (u) => (u && u !== "#" ? u : "");
    view().innerHTML = head("Contact & social", "Used in the footer, the menu, the “Let's talk” page and the email/WhatsApp fallback.", siteLink("start.html")) + `
      <form class="panel form-grid">
        <label>Email that leads should reach<input type="email" name="email" required value="${esc(c.email)}"></label>
        <label>WhatsApp number <span class="muted">(international format, digits only, e.g. 2347000000000. Leave empty to hide)</span><input name="whatsapp" inputmode="numeric" value="${esc(c.whatsapp)}"></label>
        <label>Instagram<input type="url" name="instagram" placeholder="https://www.instagram.com/…" value="${esc(val(c.instagram))}"></label>
        <label>LinkedIn<input type="url" name="linkedin" placeholder="https://www.linkedin.com/company/…" value="${esc(val(c.linkedin))}"></label>
        <label>X<input type="url" name="x" placeholder="https://x.com/…" value="${esc(val(c.x))}"></label>
        <label>TikTok<input type="url" name="tiktok" placeholder="https://www.tiktok.com/@…" value="${esc(val(c.tiktok))}"></label>
        <div class="row-end"><button class="btn btn-brand">Save</button></div>
      </form>`;
    $("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const next = { email: f.email.value.trim(), whatsapp: f.whatsapp.value.replace(/\D/g, "") };
      for (const k of ["instagram", "linkedin", "x", "tiktok"]) {
        const u = f[k].value.trim();
        if (u && !/^https:\/\//i.test(u)) return toast(`The ${k === "x" ? "X" : k[0].toUpperCase() + k.slice(1)} link must start with https://`, true);
        next[k] = u || "#";
      }
      try { await api.saveSite(Object.assign(site, { contact: Object.assign(c, next) })); toast("Contact details saved."); } catch (err) { fail(err); }
    };
  }

  /* ---------- Layout & brand ---------- */
  const BLOCKS = {
    logos: ["Client logos", "The scrolling strip of brands under the hero"],
    message: ["The one-liner", "“What we do” in one sentence that lights up as you scroll"],
    pillars: ["Be seen, be chosen, be remembered", "The three promises"],
    fit: ["Is this for me?", "The checklist visitors tick"],
    numbers: ["Numbers we're proud of", "The headline results"],
    journey: ["What happens after you say hi", "Discover → Onboard → Deliver → Grow"]
  };
  const BRANDS = [["#FF4306", "Clicksyde orange"], ["#E11D48", "Red"], ["#7C3AED", "Violet"], ["#2563EB", "Blue"], ["#0F9F6E", "Green"], ["#161616", "Black"]];
  async function layout() {
    const site = await api.getSite();
    const lay = clone(site.layout);
    D0.layout.home.forEach((b) => { if (!lay.home.includes(b)) lay.home.push(b); });
    lay.hidden = lay.hidden || [];
    let brand = site.theme.brand;
    const draw = () => {
      view().innerHTML = head("Layout & brand", "Choose which home page sections show and in what order. The hero always stays at the top.",
        `${siteLink("index.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
        <div class="two">
          <div class="panel"><h2>Home page sections</h2>
            <ol class="blocks"><li class="fixed"><b>Hero</b><span class="muted small">Headline, buttons and campaign reel · always first</span></li>
            ${lay.home.map((b, i) => { const off = lay.hidden.includes(b); return `<li data-b="${b}" class="${off ? "off" : ""}">
              <label class="switch"><input type="checkbox" ${off ? "" : "checked"} data-show><span><b>${esc(BLOCKS[b][0])}</b><span class="muted small">${esc(BLOCKS[b][1])}</span></span></label>
              <div class="moves"><button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-down aria-label="Move down" ${i === lay.home.length - 1 ? "disabled" : ""}>↓</button></div></li>`; }).join("")}
            </ol><button class="linkish" data-default>Back to the original layout</button></div>
          <div class="panel"><h2>Brand colour</h2><p class="muted small">Used for buttons, highlights and accents across the site.</p>
            <div class="brands">${BRANDS.map(([c, n]) => `<button type="button" class="brand-sw" data-c="${c}" aria-pressed="${c.toLowerCase() === brand.toLowerCase()}"><i style="background:${c}"></i>${n}</button>`).join("")}</div>
            <label>Custom colour<input type="color" value="${brand}" data-custom></label>
            <div class="brand-preview" style="--b:${brand}"><span class="btn" style="background:${brand};color:#fff">Let's talk →</span><span class="serif" style="color:${brand};font-size:28px">impossible</span></div>
          </div></div>`;
      $$("li[data-b]").forEach((li) => {
        const b = li.dataset.b, i = lay.home.indexOf(b);
        $("[data-show]", li).onchange = (e) => { lay.hidden = e.target.checked ? lay.hidden.filter((x) => x !== b) : lay.hidden.concat(b); draw(); };
        $("[data-up]", li).onclick = () => { [lay.home[i - 1], lay.home[i]] = [lay.home[i], lay.home[i - 1]]; draw(); };
        $("[data-down]", li).onclick = () => { [lay.home[i + 1], lay.home[i]] = [lay.home[i], lay.home[i + 1]]; draw(); };
      });
      $("[data-default]").onclick = () => { lay.home = clone(D0.layout.home); lay.hidden = []; brand = "#FF4306"; draw(); };
      $$(".brand-sw").forEach((s) => (s.onclick = () => { brand = s.dataset.c; draw(); }));
      $("[data-custom]").onchange = (e) => { brand = e.target.value; draw(); };
      $("[data-save]").onclick = async () => {
        try { await api.saveSite(Object.assign(site, { layout: lay, theme: { brand } })); toast("Layout and brand saved."); } catch (err) { fail(err); }
      };
    };
    draw();
  }

  /* ---------- Boot ---------- */
  window.CSmarkAdmin = () => window.CSlogo.mark();

  const signedInBefore = () => { try { return Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)); } catch (_) { return false; } };
  if (ss.get("cs-admin-mode") === "demo") start("demo");
  else if (liveReady && (signedInBefore() || /access_token|code=/.test(location.hash + location.search))) start("live");
  else loginScreen();
})();
