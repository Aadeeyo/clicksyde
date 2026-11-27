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
      copy: d.copy && typeof d.copy === "object" ? d.copy : {},
      spotlight: Object.assign(clone(D0.spotlight), d.spotlight || {}),
      reel: {
        video: (d.reel && d.reel.video) || "",
        frames: d.reel && Array.isArray(d.reel.frames) && d.reel.frames.length ? d.reel.frames : D0.reel.map((f) => (Array.isArray(f) ? { c: f[0], cap: f[1], img: "" } : f))
      },
      team: Array.isArray(d.team) ? d.team : clone(D0.team),
      form: Object.assign({}, window.CS.form, d.form || {}),
      about: {
        facts: d.about && Array.isArray(d.about.facts) ? d.about.facts : clone(D0.facts),
        timeline: d.about && Array.isArray(d.about.timeline) ? d.about.timeline : D0.timeline.map((t) => (Array.isArray(t) ? { y: t[0], h: t[1], p: t[2] } : t)),
        values: d.about && Array.isArray(d.about.values) ? d.about.values : D0.values.map((v) => (Array.isArray(v) ? { i: v[0], h: v[1], p: v[2] } : v))
      },
      cases: Array.isArray(d.cases) ? d.cases : D0.cases.map((c) => S.normCase(clone(c))),
      logoSize: ["s", "m", "l", "xl"].includes(d.logoSize) ? d.logoSize : "m",
      seo: d.seo && typeof d.seo === "object" ? d.seo : {},
      finish: d.finish === "luxe" ? "luxe" : "standard",
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
    link: (path) => path + "?demo=1",
    // videos are too big for localStorage: demo uploads of any media go to IndexedDB
    async uploadMedia(file) {
      if (!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(file.type)) throw new Error("Use a JPG, PNG, WebP or GIF image, or an MP4 or WebM video.");
      if (file.size > 50 * 1024 * 1024) throw new Error("Files must be under 50 MB.");
      return window.CSmedia.put(file);
    }
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
    link: (path) => path + "?fresh=1",
    async uploadMedia(file, folder) {
      if (!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(file.type)) throw new Error("Use a JPG, PNG, WebP or GIF image, or an MP4 or WebM video.");
      if (file.size > 50 * 1024 * 1024) throw new Error("Files must be under 50 MB. Compress the video (for example with HandBrake) and try again.");
      const name = `${folder}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60)}`;
      const { error } = await sb.storage.from("media").upload(name, file, { contentType: file.type });
      if (error) throw (/mime|size|exceed/i.test(error.message) ? new Error("The media bucket doesn't accept this file yet. Run supabase/migrations/20261127000000_clicksyde_media.sql on the Clicksyde project.") : error);
      return sb.storage.from("media").getPublicUrl(name).data.publicUrl;
    }
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
    ["cases", "Case studies", "M4 7h16v12H4zM9 7V5h6v2M4 12h16"],
    ["copy", "Page copy", "M4 6h16M4 12h10M4 18h13"],
    ["media", "Media & spotlight", "M4 5h16v14H4zM10 9l5 3-5 3z"],
    ["about", "About page", "M12 8v.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"],
    ["team", "Team", "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-3.3 3-5 6-5s5.3 1.7 6 5M16 11a2.5 2.5 0 1 0 0-5M17.5 15c2 .4 3.2 2 3.5 5"],
    ["clients", "Client logos", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
    ["contact", "Contact & social", "M21 3 3 10.5l7 2.5 2.5 7zM10 13l4-4"],
    ["form", "Contact form", "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"],
    ["seo", "SEO", "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5 20 20"],
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
      S.reset(); window.CSmedia.clear(); toast("Demo reset to the starting content."); route();
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
      else if (sec === "cases") arg ? await caseEditor(decodeURIComponent(arg)) : await cases();
      else if (sec === "copy") await pageCopy();
      else if (sec === "media") await media();
      else if (sec === "team") await team();
      else if (sec === "about") await aboutPage();
      else if (sec === "clients") await clients();
      else if (sec === "contact") await contact();
      else if (sec === "layout") await layout();
      else if (sec === "seo") await seoScreen();
      else if (sec === "form") await formScreen();
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

  /* ---------- Media & spotlight ---------- */
  const showMedia = (root) => $$("[data-media]", root).forEach((el) => window.CSmedia.resolve(el.dataset.media).then((u) => { if (u) el.src = u; }));
  const mediaTag = (src, type, cls = "") => !src ? "" : (type === "video" || /\.(mp4|webm)(\?|$)/i.test(src))
    ? `<video class="${cls}" data-media="${esc(src)}" muted loop playsinline autoplay controls preload="metadata"></video>`
    : `<img class="${cls}" data-media="${esc(S.mediaSrc(src, true) || src)}" alt="">`;
  const pick = (accept, onFile) => {
    const i = document.createElement("input"); i.type = "file"; i.accept = accept;
    i.onchange = () => { if (i.files[0]) onFile(i.files[0]); };
    i.click();
  };
  async function media() {
    const site = await api.getSite();
    const reel = site.reel, sp = site.spotlight;
    const note = mode === "demo" ? "In demo mode files are kept in this browser only." : "Images and videos up to 50 MB.";
    const busy = (b, on) => { b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? "Uploading…" : b.dataset.label; };
    const upload = async (btn, accept, folder, done) => pick(accept, async (file) => {
      busy(btn, true);
      try { done(await api.uploadMedia(file, folder), file.type.startsWith("video") ? "video" : "image"); draw(); toast("Uploaded. Save to put it on the site."); }
      catch (err) { fail(err); } finally { busy(btn, false); }
    });
    const draw = () => {
      view().innerHTML = head("Media & spotlight", `The hero reel, its campaign frames, and a Spotlight section on the home page. ${note}`,
        `${siteLink("index.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
        <div class="panel"><h2>Spotlight</h2>
          <p class="small muted" style="margin:0">Feature one campaign on the home page, right under the client logos. Change its position in Layout &amp; brand.</p>
          <label class="switch"><input type="checkbox" data-f="on" ${sp.on ? "checked" : ""}><span><b>Show the Spotlight on the home page</b></span></label>
          <div class="two">
            <div class="form-col">
              <label>Small label<input data-f="eyebrow" maxlength="60" value="${esc(sp.eyebrow)}" placeholder="Spotlight"></label>
              <label>Title<input data-f="title" maxlength="160" value="${esc(sp.title)}" placeholder="e.g. How Domino's turned reviews into sales"></label>
              <label>Text<textarea data-f="text" rows="4" maxlength="600">${esc(sp.text)}</textarea></label>
              <div class="two-col"><label>Button text<input data-f="linkText" maxlength="60" value="${esc(sp.linkText)}"></label>
                <label>Button link <span class="muted">(page or https://…)</span><input data-f="link" value="${esc(sp.link)}" placeholder="work.html#dominos"></label></div>
            </div>
            <div class="form-col"><div class="media-box">${sp.media ? mediaTag(sp.media, sp.type) : `<span class="muted small">No image or video yet</span>`}</div>
              <div class="row"><button class="btn btn-light" data-up-spot>${sp.media ? "Replace" : "Upload"} image or video</button>${sp.media ? `<button class="linkish" data-rm-spot>Remove</button>` : ""}</div></div>
          </div></div>
        <div class="panel"><h2>Hero reel video</h2>
          <p class="small muted" style="margin:0">A muted mashup of campaigns (15–30 seconds, MP4) plays inside the split hero. Without one, the campaign frames below are shown.</p>
          <div class="media-box wide">${reel.video ? mediaTag(reel.video, "video") : `<span class="muted small">Using the campaign frames</span>`}</div>
          <div class="row"><button class="btn btn-light" data-up-reel>${reel.video ? "Replace" : "Upload"} reel video</button>${reel.video ? `<button class="linkish" data-rm-reel>Remove video</button>` : ""}</div></div>
        <div class="panel"><h2>Campaign frames</h2>
          <p class="small muted" style="margin:0">The tiles that drift behind the hero headline. Give each a caption and, ideally, a still from the campaign.</p>
          <ul class="rows">${reel.frames.map((f, i) => `<li data-i="${i}">
            <div class="logo-box frame-box" style="background:${isHex(f.c) ? f.c : "#2B2B2B"}">${f.img ? mediaTag(f.img, "image") : ""}</div>
            <label class="grow">Caption<input data-cap maxlength="40" value="${esc(f.cap)}"></label>
            <label>Colour<input type="color" data-col value="${isHex(f.c) ? f.c : "#2B2B2B"}"></label>
            <button class="btn btn-light" data-img>${f.img ? "Replace still" : "Add still"}</button>${f.img ? `<button class="linkish" data-noimg>Remove still</button>` : ""}
            <div class="moves"><button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-down aria-label="Move down" ${i === reel.frames.length - 1 ? "disabled" : ""}>↓</button><button class="icon-btn danger" data-rm aria-label="Remove frame" ${reel.frames.length < 3 ? "disabled" : ""}>✕</button></div></li>`).join("")}</ul>
          ${reel.frames.length < 12 ? `<button class="btn btn-light" data-add>+ Add a frame</button>` : ""}</div>`;
      showMedia(view());
      $$("[data-f]").forEach((el) => { el.oninput = el.onchange = () => { sp[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; }; });
      const up = $("[data-up-spot]"); up.onclick = () => upload(up, "image/*,video/mp4,video/webm", "spotlight", (u, t) => { sp.media = u; sp.type = t; });
      const rs = $("[data-rm-spot]"); if (rs) rs.onclick = () => { sp.media = ""; draw(); };
      const ur = $("[data-up-reel]"); ur.onclick = () => upload(ur, "video/mp4,video/webm", "reel", (u) => { reel.video = u; });
      const rr = $("[data-rm-reel]"); if (rr) rr.onclick = () => { reel.video = ""; draw(); };
      $$("li[data-i]").forEach((li) => {
        const i = +li.dataset.i, f = reel.frames[i];
        $("[data-cap]", li).oninput = (e) => { f.cap = e.target.value; };
        $("[data-col]", li).oninput = (e) => { f.c = e.target.value; $(".logo-box", li).style.background = f.c; };
        const b = $("[data-img]", li); b.onclick = () => upload(b, "image/*", "reel", (u) => { f.img = u; });
        const n = $("[data-noimg]", li); if (n) n.onclick = () => { f.img = ""; draw(); };
        $("[data-up]", li).onclick = () => { [reel.frames[i - 1], reel.frames[i]] = [reel.frames[i], reel.frames[i - 1]]; draw(); };
        $("[data-down]", li).onclick = () => { [reel.frames[i + 1], reel.frames[i]] = [reel.frames[i], reel.frames[i + 1]]; draw(); };
        $("[data-rm]", li).onclick = () => { reel.frames.splice(i, 1); draw(); };
      });
      const add = $("[data-add]"); if (add) add.onclick = () => { reel.frames.push({ c: "#2B2B2B", cap: "New campaign", img: "" }); draw(); };
      $("[data-save]").onclick = async () => {
        if (sp.on && !sp.title && !sp.media) return toast("Give the Spotlight a title or an image before switching it on.", true);
        if (sp.link && !/^(https:\/\/|[\w.\/-]+\.html(#[\w-]+)?$)/.test(sp.link)) return toast("The button link must be a page like work.html#dominos or start with https://", true);
        try { await api.saveSite(site); toast("Media and spotlight saved."); } catch (err) { fail(err); }
      };
    };
    draw();
  }

  /* ---------- About page: fun facts, story timeline, values ---------- */
  async function aboutPage() {
    const site = await api.getSite();
    const ab = site.about;
    const LISTS = {
      facts: { title: "Fun facts", hint: "The flip cards under “Like what exactly?”. Visitors tap a question to flip it.", max: 12,
        blank: () => ({ q: "", a: "", tag: "" }),
        fields: [["q", "Question", 80, "e.g. Favourite food?"], ["a", "Answer", 300, "", true], ["tag", "Small label", 40, "e.g. Asked by everyone"]] },
      timeline: { title: "Our story", hint: "The timeline on the dark band, in order from first to latest.", max: 10,
        blank: () => ({ y: "", h: "", p: "" }),
        fields: [["y", "Year or label", 12, "2021 or Now"], ["h", "Heading", 120, ""], ["p", "Text", 500, "", true]] },
      values: { title: "What we believe", hint: "The values cards. The icon is optional (an emoji, or leave it empty).", max: 8,
        blank: () => ({ i: "", h: "", p: "" }),
        fields: [["i", "Icon", 4, "🎯"], ["h", "Heading", 60, ""], ["p", "Text", 300, "", true]] }
    };
    const read = () => $$("[data-list] li[data-i]").forEach((li) => {
      const item = ab[li.closest("[data-list]").dataset.list][+li.dataset.i];
      $$("[data-k]", li).forEach((inp) => { item[inp.dataset.k] = inp.value; });
    });
    const draw = () => {
      view().innerHTML = head("About page", "The fun facts, the story timeline and the values on the About page. The headline, intro and section titles are edited on the page itself (Page copy).",
        `${siteLink("about.html")}<button class="btn btn-brand" data-save>Save</button>`) +
        Object.entries(LISTS).map(([key, L]) => `<div class="panel" data-list="${key}"><h2>${L.title}</h2><p class="small muted" style="margin:0">${L.hint}</p>
          <ul class="rows">${ab[key].map((it, i) => `<li data-i="${i}" style="align-items:stretch">
            ${L.fields.map(([k, label, max, ph, long]) => long
              ? `<label class="grow wide">${label}<textarea data-k="${k}" rows="2" maxlength="${max}" placeholder="${esc(ph)}">${esc(it[k] || "")}</textarea></label>`
              : `<label class="${k === "i" || k === "y" ? "" : "grow"}"${k === "i" ? ' style="width:80px"' : k === "y" ? ' style="width:120px"' : ""}>${label}<input data-k="${k}" maxlength="${max}" value="${esc(it[k] || "")}" placeholder="${esc(ph)}"></label>`).join("")}
            <div class="moves" style="align-self:center"><button class="icon-btn" data-up ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="icon-btn" data-down ${i === ab[key].length - 1 ? "disabled" : ""} aria-label="Move down">↓</button><button class="icon-btn danger" data-rm aria-label="Remove">✕</button></div></li>`).join("")}</ul>
          ${ab[key].length < L.max ? `<button class="btn btn-light" data-add>+ Add</button>` : ""}</div>`).join("");
      $$("[data-list]").forEach((panel) => {
        const key = panel.dataset.list, arr = ab[key];
        $$("li[data-i]", panel).forEach((li) => {
          const i = +li.dataset.i;
          $("[data-up]", li).onclick = () => { read(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); };
          $("[data-down]", li).onclick = () => { read(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); };
          $("[data-rm]", li).onclick = () => { read(); arr.splice(i, 1); draw(); };
        });
        const add = $("[data-add]", panel);
        if (add) add.onclick = () => { read(); arr.push(LISTS[key].blank()); draw(); $$(`[data-list="${key}"] li[data-i]`).pop().querySelector("input, textarea").focus(); };
      });
      $("[data-save]").onclick = async () => {
        read();
        ab.facts = ab.facts.map((f) => ({ q: f.q.trim(), a: f.a.trim(), tag: f.tag.trim() })).filter((f) => f.q);
        ab.timeline = ab.timeline.map((t) => ({ y: t.y.trim(), h: t.h.trim(), p: t.p.trim() })).filter((t) => t.h || t.p);
        ab.values = ab.values.map((v) => ({ i: v.i.trim(), h: v.h.trim(), p: v.p.trim() })).filter((v) => v.h);
        try { await api.saveSite(site); toast("About page saved."); draw(); } catch (err) { fail(err); }
      };
    };
    draw();
  }

  /* ---------- Team ---------- */
  const TEAM_COLORS = ["#FF4306", "#171512", "#26B3A6", "#C9B6F2", "#2B6CB0", "#F6A8C5"];
  async function team() {
    const site = await api.getSite();
    const list = site.team;
    const draw = () => {
      view().innerHTML = head("Team", "The people on the About page, in this order. Update a role when someone changes position.",
        `${siteLink("about.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
        <ul class="rows">${list.map((m, i) => `<li data-i="${i}">
          <div class="logo-box photo" style="background:${isHex(m.c) ? m.c : "#171512"}">${m.photo ? mediaTag(m.photo, "image") : `<span>${esc((m.n || "?").split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase())}</span>`}</div>
          <label class="grow">Name<input data-k="n" maxlength="80" value="${esc(m.n)}"></label>
          <label class="grow">Role<input data-k="r" maxlength="80" value="${esc(m.r)}" placeholder="e.g. Head of Strategy"></label>
          <label class="grow wide">One odd fact <span class="muted">(optional)</span><input data-k="odd" maxlength="160" value="${esc(m.odd)}"></label>
          <label>Colour<input type="color" data-col value="${isHex(m.c) ? m.c : "#171512"}"></label>
          <button class="btn btn-light" data-photo>${m.photo ? "Replace photo" : "Add photo"}</button>${m.photo ? `<button class="linkish" data-nophoto>Remove photo</button>` : ""}
          <div class="moves"><button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-down aria-label="Move down" ${i === list.length - 1 ? "disabled" : ""}>↓</button><button class="icon-btn danger" data-rm aria-label="Remove ${esc(m.n)}">✕</button></div></li>`).join("")}</ul>
        <button class="btn btn-light" data-add>+ Add a person</button>
        <p class="small muted">Square photos look best (at least 600 × 600). ${mode === "demo" ? "In demo mode photos are kept in this browser only." : ""}</p>`;
      showMedia(view());
      $$("li[data-i]").forEach((li) => {
        const i = +li.dataset.i, m = list[i];
        $$("[data-k]", li).forEach((inp) => { inp.oninput = () => { m[inp.dataset.k] = inp.value; }; });
        $("[data-col]", li).oninput = (e) => { m.c = e.target.value; $(".logo-box", li).style.background = m.c; };
        const b = $("[data-photo]", li);
        b.onclick = () => pick("image/*", async (file) => {
          b.disabled = true; b.textContent = "Uploading…";
          try { m.photo = await api.uploadMedia(file, "team"); draw(); toast("Photo added. Save to put it on the site."); } catch (err) { fail(err); draw(); }
        });
        const np = $("[data-nophoto]", li); if (np) np.onclick = () => { m.photo = ""; draw(); };
        $("[data-up]", li).onclick = () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); };
        $("[data-down]", li).onclick = () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); };
        $("[data-rm]", li).onclick = () => { if (confirm(`Remove ${m.n || "this person"} from the team?`)) { list.splice(i, 1); draw(); } };
      });
      $("[data-add]").onclick = () => { list.push({ n: "", r: "", odd: "", c: TEAM_COLORS[list.length % TEAM_COLORS.length], photo: "" }); draw(); $$("[data-k=n]").pop().focus(); };
      $("[data-save]").onclick = async () => {
        site.team = list.map((m) => Object.assign(m, { n: (m.n || "").trim(), r: (m.r || "").trim(), odd: (m.odd || "").trim() })).filter((m) => m.n);
        try { await api.saveSite(site); toast("Team saved."); team(); } catch (err) { fail(err); }
      };
    };
    draw();
  }

  /* ---------- Case studies (Work page) ---------- */
  async function cases() {
    const site = await api.getSite();
    const list = site.cases;
    const save = async (msg) => { try { await api.saveSite(site); toast(msg); draw(); } catch (err) { fail(err); } };
    const draw = () => {
      view().innerHTML = head("Case studies", "The work on the Work page, in this order. Drafts stay hidden from visitors.",
        `${siteLink("work.html")}<a class="btn btn-brand" href="#cases/new">New case study</a>`) +
        (list.length ? `<ul class="notes-admin">${list.map((c, i) => `<li>
          <div class="mini-note" style="background:linear-gradient(150deg, ${isHex(c.color) ? c.color : "#2B2B2B"}, #171512 140%);color:#fff"><span>${String(i + 1).padStart(2, "0")}</span><b>${esc(c.client)}</b></div>
          <div class="grow"><b>${esc(c.title || c.client)}</b> ${c.published === false ? `<span class="pill s-draft">draft</span>` : `<span class="pill s-won">published</span>`}
            <p class="muted small">${esc(c.sub || "")}</p><p class="small">${(c.stats || []).slice(0, 3).map((s) => `<b>${esc(s.n)}</b> ${esc(s.l)}`).join(" · ")}</p></div>
          <div class="moves"><a class="btn btn-light" href="#cases/${encodeURIComponent(c.id)}">Edit</a>
            <button class="icon-btn" data-up="${i}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn" data-down="${i}" aria-label="Move down" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-btn danger" data-rm="${i}" aria-label="Delete ${esc(c.client)}">✕</button></div></li>`).join("")}</ul>
          <p class="small muted">Reordering and deleting save straight away. The home page's “How we did it for Domino's” button links to work.html#dominos.</p>`
        : `<p class="muted empty">No case studies yet. <a href="#cases/new">Add the first one.</a></p>`);
      $$("[data-up]").forEach((b) => (b.onclick = () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; save("Order saved."); }));
      $$("[data-down]").forEach((b) => (b.onclick = () => { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; save("Order saved."); }));
      $$("[data-rm]").forEach((b) => (b.onclick = () => {
        const c = list[+b.dataset.rm];
        if (!confirm(`Delete the ${c.client} case study? This can't be undone.`)) return;
        list.splice(+b.dataset.rm, 1); save("Case study deleted.");
      }));
    };
    draw();
  }

  async function caseEditor(id) {
    const site = await api.getSite();
    const isNew = id === "new";
    const found = site.cases.find((c) => c.id === id);
    if (!isNew && !found) { view().innerHTML = head("Case study not found") + `<p><a href="#cases">← All case studies</a></p>`; return; }
    const c = isNew ? { id: "", client: "", color: "#2B2B2B", tags: [], cat: "show", title: "", sub: "", published: false,
      slides: [{ c: "#2B2B2B", cap: "The brief", big: "", media: "", type: "image" }], stats: [{ n: "", l: "", hot: true }],
      story: [{ h: "The challenge", p: "" }, { h: "What we did", p: "" }, { h: "The result", p: "" }], quote: { who: "", role: "", said: "" }, reply: "" } : clone(found);
    c.quote = c.quote || { who: "", role: "", said: "" };
    let slugTouched = !isNew;
    const busy = (b, on) => { b.disabled = on; b.dataset.label = b.dataset.label || b.textContent; b.textContent = on ? "Uploading…" : b.dataset.label; };
    const read = () => {
      const f = $(".case-form");
      ["client", "title", "sub", "reply"].forEach((k) => { c[k] = f[k].value; });
      c.id = f.id.value.trim(); c.cat = f.cat.value; c.color = f.color.value; c.published = f.published.checked;
      c.tags = f.tags.value.split(",").map((t) => t.trim()).filter(Boolean);
      c.quote = { who: f.qwho.value, role: f.qrole.value, said: f.qsaid.value };
      $$("[data-slide]").forEach((row, i) => Object.assign(c.slides[i], { cap: $("[data-k=cap]", row).value, big: $("[data-k=big]", row).value, c: $("[data-k=c]", row).value }));
      $$("[data-stat]").forEach((row, i) => Object.assign(c.stats[i], { n: $("[data-k=n]", row).value, l: $("[data-k=l]", row).value, hot: $("[data-k=hot]", row).checked }));
      $$("[data-story]").forEach((row, i) => Object.assign(c.story[i], { h: $("[data-k=h]", row).value, p: $("[data-k=p]", row).value }));
    };
    const draw = () => {
      view().innerHTML = head(isNew ? "New case study" : "Edit case study", `<a href="#cases">← All case studies</a>`, !isNew && c.published !== false ? siteLink(`work.html#${c.id}`) : "") + `
        <form class="case-form editor">
          <div class="ed-main">
            <div class="panel"><h3>The basics</h3>
              <div class="two-col"><label>Client<input name="client" required maxlength="80" value="${esc(c.client)}" placeholder="e.g. Domino's Pizza"></label>
                <label>Web address <span class="muted">(work.html#…)</span><input name="id" required maxlength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(c.id)}" ${isNew ? "" : "readonly"}></label></div>
              <label>Headline<input name="title" maxlength="120" value="${esc(c.title)}" placeholder="Usually the client's name"></label>
              <label>One-line summary<input name="sub" maxlength="200" value="${esc(c.sub)}" placeholder="e.g. How we turned customers' feedback into a stronger product story"></label>
              <div class="two-col"><label>Tags <span class="muted">(comma separated)</span><input name="tags" value="${esc((c.tags || []).join(", "))}" placeholder="Marketing, Customer Feedback"></label>
                <label>Filter on the Work page<select name="cat">${S.caseCats.map(([k, l]) => `<option value="${k}" ${c.cat === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label></div>
            </div>
            <div class="panel"><h3>Slides <span class="muted small">(the image carousel, up to 6)</span></h3>
              <ul class="rows">${c.slides.map((s, i) => `<li data-slide="${i}">
                <div class="logo-box frame-box" style="background:${isHex(s.c) ? s.c : "#2B2B2B"}">${s.media ? mediaTag(s.media, s.type) : ""}</div>
                <label class="grow">Caption<input data-k="cap" maxlength="40" value="${esc(s.cap)}"></label>
                <label class="grow">Big text <span class="muted">(optional, over the slide)</span><input data-k="big" maxlength="60" value="${esc((s.big || "").replace(/\n/g, " / "))}" placeholder="Line one / line two"></label>
                <label>Colour<input type="color" data-k="c" value="${isHex(s.c) ? s.c : "#2B2B2B"}"></label>
                <button type="button" class="btn btn-light" data-media>${s.media ? "Replace" : "Add"} image or video</button>${s.media ? `<button type="button" class="linkish" data-nomedia>Remove</button>` : ""}
                <div class="moves"><button type="button" class="icon-btn" data-up ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button type="button" class="icon-btn" data-down ${i === c.slides.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button><button type="button" class="icon-btn danger" data-rm aria-label="Remove slide">✕</button></div></li>`).join("")}</ul>
              ${c.slides.length < 6 ? `<button type="button" class="btn btn-light" data-add-slide>+ Add a slide</button>` : ""}</div>
            <div class="panel"><h3>Results <span class="muted small">(up to 4 numbers)</span></h3>
              <ul class="rows">${c.stats.map((s, i) => `<li data-stat="${i}">
                <label>Number<input data-k="n" maxlength="14" value="${esc(s.n)}" placeholder="250k+" style="width:120px"></label>
                <label class="grow">What it measures<input data-k="l" maxlength="60" value="${esc(s.l)}" placeholder="revenue generated"></label>
                <label class="switch"><input type="checkbox" data-k="hot" ${s.hot ? "checked" : ""}><span>Highlight</span></label>
                <div class="moves"><button type="button" class="icon-btn danger" data-rm aria-label="Remove result">✕</button></div></li>`).join("")}</ul>
              ${c.stats.length < 4 ? `<button type="button" class="btn btn-light" data-add-stat>+ Add a result</button>` : ""}</div>
            <div class="panel"><h3>The full story</h3>
              <ul class="rows">${c.story.map((s, i) => `<li data-story="${i}" style="align-items:stretch">
                <label class="grow">Heading<input data-k="h" maxlength="60" value="${esc(s.h)}"></label>
                <label class="grow wide">Text<textarea data-k="p" rows="3" maxlength="1400">${esc(s.p)}</textarea></label>
                <div class="moves"><button type="button" class="icon-btn danger" data-rm aria-label="Remove part">✕</button></div></li>`).join("")}</ul>
              ${c.story.length < 6 ? `<button type="button" class="btn btn-light" data-add-story>+ Add a part</button>` : ""}</div>
            <div class="panel"><h3>In the client's words</h3>
              <div class="two-col"><label>Name or company<input name="qwho" maxlength="80" value="${esc(c.quote.who)}" placeholder="${esc(c.client || "Client")}"></label>
                <label>Role<input name="qrole" maxlength="80" value="${esc(c.quote.role)}" placeholder="Head of Marketing"></label></div>
              <label>Testimonial <span class="muted">(only publish words the client has approved)</span><textarea name="qsaid" rows="3" maxlength="700">${esc(c.quote.said)}</textarea></label>
              <label>Clicksyde's reply <span class="muted">(optional)</span><textarea name="reply" rows="2" maxlength="700">${esc(c.reply)}</textarea></label>
            </div>
          </div>
          <div class="ed-side">
            <div class="panel"><h3>Publishing</h3>
              <label class="switch"><input type="checkbox" name="published" ${c.published !== false ? "checked" : ""}><span>Published on the Work page</span></label>
              <label>Client colour<input type="color" name="color" value="${isHex(c.color) ? c.color : "#2B2B2B"}"></label>
            </div>
            <div class="row-end">${isNew ? "" : `<button type="button" class="btn btn-ghost danger" data-del>Delete</button>`}<button class="btn btn-brand" type="submit">${isNew ? "Save case study" : "Save changes"}</button></div>
          </div>
        </form>`;
      showMedia(view());
      const f = $(".case-form");
      f.client.oninput = () => { if (!slugTouched) f.id.value = slugify(f.client.value).slice(0, 40); };
      f.id.oninput = () => { slugTouched = true; };
      const rows = (attr, arr) => $$(`[${attr}]`).forEach((row) => {
        const i = +row.getAttribute(attr);
        const up = $("[data-up]", row), down = $("[data-down]", row), rm = $("[data-rm]", row);
        if (up) up.onclick = () => { read(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); };
        if (down) down.onclick = () => { read(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); };
        if (rm) rm.onclick = () => { read(); arr.splice(i, 1); draw(); };
      });
      rows("data-slide", c.slides); rows("data-stat", c.stats); rows("data-story", c.story);
      $$("[data-slide]").forEach((row) => {
        const s = c.slides[+row.dataset.slide];
        const b = $("[data-media]", row);
        b.onclick = () => pick("image/*,video/mp4,video/webm", async (file) => {
          read(); busy(b, true);
          try { s.media = await api.uploadMedia(file, "cases"); s.type = file.type.startsWith("video") ? "video" : "image"; draw(); toast("Added. Save to put it on the site."); }
          catch (err) { fail(err); busy(b, false); }
        });
        const nm = $("[data-nomedia]", row); if (nm) nm.onclick = () => { read(); s.media = ""; draw(); };
      });
      const add = (sel, arr, item) => { const b = $(sel); if (b) b.onclick = () => { read(); arr.push(item()); draw(); }; };
      add("[data-add-slide]", c.slides, () => ({ c: c.color || "#2B2B2B", cap: "", big: "", media: "", type: "image" }));
      add("[data-add-stat]", c.stats, () => ({ n: "", l: "", hot: false }));
      add("[data-add-story]", c.story, () => ({ h: "", p: "" }));
      const del = $("[data-del]");
      if (del) del.onclick = async () => {
        if (!confirm(`Delete the ${c.client} case study? This can't be undone.`)) return;
        site.cases = site.cases.filter((x) => x.id !== c.id);
        try { await api.saveSite(site); toast("Case study deleted."); location.hash = "#cases"; } catch (err) { fail(err); }
      };
      f.onsubmit = async (e) => {
        e.preventDefault(); read();
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) return toast("The web address can only use lowercase letters, numbers and dashes.", true);
        if (isNew && site.cases.some((x) => x.id === c.id)) return toast("Another case study already uses that web address.", true);
        c.client = c.client.trim(); c.title = c.title.trim() || c.client;
        c.slides.forEach((s) => { s.big = (s.big || "").split(" / ").join("\n").trim(); });
        c.stats = c.stats.filter((s) => s.n.trim());
        c.story = c.story.filter((s) => s.h.trim() || s.p.trim());
        if (isNew) site.cases.push(c); else site.cases[site.cases.findIndex((x) => x.id === c.id)] = c;
        try { await api.saveSite(site); toast(c.published ? "Saved and live on the Work page." : "Draft saved."); location.hash = "#cases"; } catch (err) { fail(err); }
      };
    };
    draw();
  }

  /* ---------- Contact form ("Let's talk"): wording and answer options ---------- */
  async function formScreen() {
    const site = await api.getSite();
    const f = site.form;
    const T = (k, label, hint = "", long = false, max = 300) => `<label class="${long ? "wide" : ""}">${label}${hint ? ` <span class="muted">${hint}</span>` : ""}${long
      ? `<textarea data-k="${k}" rows="2" maxlength="${max}">${esc(f[k] || "")}</textarea>` : `<input data-k="${k}" maxlength="${max}" value="${esc(f[k] || "")}">`}</label>`;
    const O = (k, label, max) => `<label class="wide">${label} <span class="muted">(one per line, up to ${max})</span><textarea data-opts="${k}" rows="${Math.min(10, (f[k] || []).length + 1)}">${esc((f[k] || []).join("\n"))}</textarea></label>`;
    view().innerHTML = head("Contact form", "The wording of the “Let's talk” chat and its answer options. The four steps stay the same so every lead fits the Leads screen.",
      `${siteLink("start.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
      <div class="panel form-grid">${T("intro", "Welcome line", "", true)}</div>
      <div class="panel form-grid"><h3 class="span">1 of 4 · What they need</h3>${T("q1", "Question", "", true)}${O("needs", "Options (visitors can pick several)", 10)}</div>
      <div class="panel form-grid"><h3 class="span">2 of 4 · Who they are</h3>${T("q2", "Question", "", true)}
        ${T("nameLabel", "Name field label")}${T("bizLabel", "Business field label")}${T("aboutLabel", "Optional note label")}${T("aboutPlaceholder", "Optional note example text")}</div>
      <div class="panel form-grid"><h3 class="span">3 of 4 · Budget and timeline</h3>${T("q3", "Question", "({name} becomes their first name)", true)}
        ${T("budgetLabel", "Budget label")}${O("budgets", "Budget options (visitors pick one)", 12)}
        ${T("timelineLabel", "Timeline label")}${T("timelineHint", "Timeline hint", "(optional)")}${O("timelines", "Timeline options (visitors pick one)", 12)}</div>
      <div class="panel form-grid"><h3 class="span">4 of 4 · How to reach them</h3>${T("q4", "Question", "", true)}${T("contactLabel", "Contact field label")}${T("contactPlaceholder", "Contact field example text")}${T("send", "Send button")}</div>
      <p class="small muted">Answers already received keep the wording they were sent with. Options are limited to 80 characters each.</p>`;
    $("[data-save]").onclick = async () => {
      $$("[data-k]").forEach((el) => { f[el.dataset.k] = el.value.trim(); });
      for (const el of $$("[data-opts]")) {
        const k = el.dataset.opts, max = k === "needs" ? 10 : 12;
        const list = el.value.split("\n").map((x) => x.trim().slice(0, 80)).filter(Boolean);
        if (!list.length) return toast("Each list needs at least one option.", true);
        if (list.length > max) return toast(`Keep it to ${max} options or fewer.`, true);
        f[k] = list;
      }
      try { await api.saveSite(site); toast("Contact form saved."); formScreen(); } catch (err) { fail(err); }
    };
  }

  /* ---------- SEO: search title + description per page ---------- */
  const SEO_PAGES = [["home", "index.html", "Home", ""], ["wall", "services.html", "Services", "services.html"], ["work", "work.html", "Work", "work.html"],
    ["insights", "insights.html", "Insights", "insights.html"], ["about", "about.html", "About", "about.html"], ["talk", "start.html", "Contact", "start.html"]];
  async function seoScreen() {
    const site = await api.getSite();
    // the wording in each page's code, shown until the admin changes it
    const defaults = {};
    await Promise.all(SEO_PAGES.map(async ([id, file]) => {
      try {
        const doc = new DOMParser().parseFromString(await (await fetch(file, { cache: "no-store" })).text(), "text/html");
        defaults[id] = { title: doc.title, description: (doc.querySelector("meta[name=description]") || {}).content || "" };
      } catch (_) { defaults[id] = { title: "", description: "" }; }
    }));
    const seo = site.seo;
    const val = (id, k) => (seo[id] && seo[id][k]) || defaults[id][k] || "";
    view().innerHTML = head("SEO", "How each page appears in Google and when it's shared. Aim for a title under 60 characters and a description under 160 that says what the page offers and where.",
      `<button class="btn btn-brand" data-save>Save</button>`) + `
      <ul class="rows seo-rows">${SEO_PAGES.map(([id, file, name, path]) => `<li data-p="${id}">
        <div class="grow wide seo-fields"><b>${name}</b>
          <label>Title <span class="count" data-c="title"></span><input data-k="title" maxlength="70" value="${esc(val(id, "title"))}"></label>
          <label>Description <span class="count" data-c="description"></span><textarea data-k="description" rows="2" maxlength="170">${esc(val(id, "description"))}</textarea></label>
          ${seo[id] ? `<button class="linkish" data-reset>Back to the original</button>` : ""}</div>
        <div class="serp"><span class="serp-url">clicksyde.com${path ? " › " + esc(path.replace(".html", "")) : ""}</span><span class="serp-title"></span><span class="serp-desc"></span></div></li>`).join("")}</ul>
      <div class="panel"><h3>Also in place</h3><p class="small muted" style="margin:0">Share previews (image, title and description) for WhatsApp, LinkedIn and X, a sitemap for Google, business details for search results, and hidden demo and edit links. After launch, add the site to Google Search Console and submit <code>clicksyde.com/sitemap.xml</code>.</p></div>`;
    const sync = (li) => {
      const t = $("[data-k=title]", li).value, d = $("[data-k=description]", li).value;
      const ct = $("[data-c=title]", li), cd = $("[data-c=description]", li);
      ct.textContent = `${t.length}/60`; ct.classList.toggle("over", t.length > 60);
      cd.textContent = `${d.length}/160`; cd.classList.toggle("over", d.length > 160);
      $(".serp-title", li).textContent = t.length > 60 ? t.slice(0, 58) + "…" : t;
      $(".serp-desc", li).textContent = d.length > 160 ? d.slice(0, 157) + "…" : d;
    };
    $$("li[data-p]").forEach((li) => {
      $$("[data-k]", li).forEach((inp) => (inp.oninput = () => sync(li)));
      sync(li);
      const r = $("[data-reset]", li);
      if (r) r.onclick = async () => { delete seo[li.dataset.p]; try { await api.saveSite(site); toast("Back to the original wording."); seoScreen(); } catch (err) { fail(err); } };
    });
    $("[data-save]").onclick = async () => {
      $$("li[data-p]").forEach((li) => {
        const id = li.dataset.p, t = $("[data-k=title]", li).value.trim(), d = $("[data-k=description]", li).value.trim();
        if (t === defaults[id].title && d === defaults[id].description) delete seo[id];
        else seo[id] = { title: t || defaults[id].title, description: d || defaults[id].description };
      });
      try { await api.saveSite(site); toast("SEO saved."); seoScreen(); } catch (err) { fail(err); }
    };
  }

  /* ---------- Page copy: edited on the page itself (js/editor.js) ---------- */
  const PAGES = [["home", "index.html", "Home"], ["services", "services.html", "Services"], ["work", "work.html", "Work"],
    ["insights", "insights.html", "Insights"], ["about", "about.html", "About"], ["start", "start.html", "Contact"]];
  async function pageCopy() {
    const site = await api.getSite();
    const count = (p) => Object.keys(site.copy).filter((k) => k.startsWith(p + ".")).length;
    const editLink = (file) => api.link(file) + "&edit=1";
    view().innerHTML = head("Page copy", "Headlines, intros, buttons and section text on every page. Open a page, click any outlined text, type, and save.") + `
      <ul class="rows">${PAGES.map(([id, file, name]) => `<li>
        <div class="grow"><b>${name}</b><p class="muted small" style="margin:2px 0 0">${count(id) ? `${count(id)} text${count(id) === 1 ? "" : "s"} changed from the original` : "Original wording"}</p></div>
        <a class="btn btn-brand" href="${esc(editLink(file))}">Edit on page</a>
        ${count(id) ? `<button class="linkish" data-reset="${id}">Back to original</button>` : ""}</li>`).join("")}</ul>
      <div class="panel"><h3>How it works</h3>
        <p class="small muted" style="margin:0">Each page opens with its text outlined. Click a text and type; press Enter to finish a line. <b>Original wording</b> puts back the text the site launched with. Nothing changes for visitors until you press <b>Save</b>${mode === "demo" ? " (in demo mode, saving only affects this browser)" : ""}.</p>
        <p class="small muted" style="margin:0">Services, case studies, articles, media, the team, the About page lists, client logos and contact details have their own sections in this admin.</p></div>`;
    $$("[data-reset]").forEach((b) => (b.onclick = async () => {
      const id = b.dataset.reset;
      if (!confirm(`Put every text on ${PAGES.find((p) => p[0] === id)[2]} back to its original wording?`)) return;
      Object.keys(site.copy).forEach((k) => { if (k.startsWith(id + ".")) delete site.copy[k]; });
      try { await api.saveSite(site); toast("Back to the original wording."); route(); } catch (err) { fail(err); }
    }));
  }

  /* ---------- Client logos ---------- */
  const LOGO_SIZES = [["s", "Small"], ["m", "Medium"], ["l", "Large"], ["xl", "Extra large"]];
  async function clients() {
    const site = await api.getSite();
    let list = clone(site.clients);
    let size = ["s", "m", "l", "xl"].includes(site.logoSize) ? site.logoSize : "m";
    const pct = (c) => Math.round((Number(c.scale) || 1) * 100);
    const preview = () => `<div class="strip marquee size-${size}">${list.map((c) => { const src = S.imgSrc(c.logo, true); return src ? `<img src="${esc(src)}" alt="${esc(c.n)}" style="--s:${(Number(c.scale) || 1)}">` : `<span>${esc(c.n || "Brand")}</span>`; }).join("")}</div>`;
    const draw = () => {
      view().innerHTML = head("Client logos", "Brands in the “Trusted by” strip on the home page, in this order. Brands without a logo show as text.",
        `${siteLink("index.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
        <div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Logo size</h3>
          <div class="seg" role="group" aria-label="Logo size">${LOGO_SIZES.map(([k, l]) => `<button class="seg-btn" data-size="${k}" aria-pressed="${k === size}">${l}</button>`).join("")}</div></div>
          <p class="small muted" style="margin:0">Sets the size of every logo in the strip. If one logo still looks small (its file has a lot of empty space around it), use its own size slider below.</p>
          <div class="strip-wrap">${preview()}</div></div>
        <ul class="rows">${list.map((c, i) => { const src = S.imgSrc(c.logo, true); return `<li data-i="${i}">
          <div class="logo-box">${src ? `<img src="${esc(src)}" alt="">` : `<span class="muted small">No logo</span>`}</div>
          <label class="grow">Brand name<input value="${esc(c.n)}" maxlength="80" data-name></label>
          <label class="logo-scale">Size <output>${pct(c)}%</output><input type="range" min="50" max="250" step="10" value="${pct(c)}" data-scale ${src ? "" : "disabled"}></label>
          <label class="btn btn-light file">${src ? "Replace logo" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-file></label>
          ${src ? `<button class="linkish" data-nologo>Remove logo</button>` : ""}
          <div class="moves"><button class="icon-btn" data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-down aria-label="Move down" ${i === list.length - 1 ? "disabled" : ""}>↓</button><button class="icon-btn danger" data-rm aria-label="Remove ${esc(c.n)}">✕</button></div>
        </li>`; }).join("")}</ul>
        <div class="row"><button class="btn btn-light" data-add>+ Add a brand</button><label class="btn btn-light file">Add several logos<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden data-many></label></div>
        <p class="small muted">Tip: logos on a transparent background, cropped close to the mark and at least 300px wide, look best. ${mode === "demo" ? "In demo mode logos must be under 400 KB." : "Up to 5 MB each."}</p>`;
      $$("li[data-i]").forEach((li) => {
        const i = +li.dataset.i;
        $("[data-name]", li).oninput = (e) => { list[i].n = e.target.value; };
        $("[data-scale]", li).oninput = (e) => {
          list[i].scale = +e.target.value / 100;
          $("output", li).textContent = e.target.value + "%";
          $(".strip-wrap").innerHTML = preview();
        };
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
      $$("[data-size]").forEach((b) => (b.onclick = () => { size = b.dataset.size; $$("[data-size]").forEach((x) => x.setAttribute("aria-pressed", x === b)); $(".strip-wrap").innerHTML = preview(); }));
      $("[data-many]").onchange = async (e) => {
        const files = Array.from(e.target.files); let added = 0;
        for (const file of files) {
          try {
            const logo = await api.upload(file, "clients");
            const n = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()).trim();
            list.push({ n: n || "New brand", logo }); added++;
          } catch (err) { fail(err); }
        }
        draw();
        if (added) toast(`${added} logo${added === 1 ? "" : "s"} added. Check the names, then Save.`);
      };
      $("[data-save]").onclick = async () => {
        list = list.map((c) => Object.assign(c, { n: c.n.trim() })).filter((c) => c.n);
        try { await api.saveSite(Object.assign(site, { clients: list, logoSize: size })); toast("Client logos saved."); draw(); } catch (err) { fail(err); }
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
    spotlight: ["Spotlight", "One featured campaign (switch it on in Media & spotlight)"],
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
    let finish = site.finish;
    const draw = () => {
      view().innerHTML = head("Layout & brand", "Choose which home page sections show and in what order. The hero always stays at the top.",
        `${siteLink("index.html")}<button class="btn btn-brand" data-save>Save</button>`) + `
        <div class="panel"><div class="row" style="justify-content:space-between"><div><h2>Finish</h2>
            <p class="small muted" style="margin:4px 0 0">Luxe keeps the same design and adds calmer pacing, word-by-word headline reveals, images that unveil as you scroll, a fine film grain, a deeper espresso and sand palette with orange as an accent, and a short branded intro on the first visit.</p></div>
            <div class="seg" role="group" aria-label="Finish"><button class="seg-btn" data-finish="standard" aria-pressed="${finish === "standard"}">Standard</button><button class="seg-btn" data-finish="luxe" aria-pressed="${finish === "luxe"}">Luxe</button></div></div>
          <div class="row"><a class="btn btn-light" href="${esc(api.link("index.html") + "&luxe=0")}" target="_blank" rel="noopener">Preview Standard ↗</a><a class="btn btn-light" href="${esc(api.link("index.html") + "&luxe=1")}" target="_blank" rel="noopener">Preview Luxe ↗</a>
            <span class="small muted">Previews don't change anything for visitors. Save to make your choice live.</span></div></div>
        <div class="two">
          <div class="panel"><h2>Home page sections</h2>
            <ol class="blocks"><li class="fixed"><b>Hero</b><span class="muted small">Headline, buttons and campaign reel · always first</span></li>
            ${lay.home.map((b, i) => { const off = lay.hidden.includes(b); return `<li data-b="${b}" class="${off ? "off" : ""}">
              <label class="switch"><input type="checkbox" ${off ? "" : "checked"} data-show><span><b>${esc((BLOCKS[b] || [b])[0])}</b><span class="muted small">${esc((BLOCKS[b] || ["", ""])[1])}</span></span></label>
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
      $("[data-default]").onclick = () => { lay.home = clone(D0.layout.home); lay.hidden = []; brand = "#FF4306"; finish = "standard"; draw(); };
      $$(".brand-sw").forEach((s) => (s.onclick = () => { brand = s.dataset.c; draw(); }));
      $$("[data-finish]").forEach((b) => (b.onclick = () => { finish = b.dataset.finish; draw(); }));
      $("[data-custom]").onchange = (e) => { brand = e.target.value; draw(); };
      $("[data-save]").onclick = async () => {
        try { await api.saveSite(Object.assign(site, { layout: lay, theme: { brand }, finish })); toast("Layout and brand saved."); } catch (err) { fail(err); }
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
