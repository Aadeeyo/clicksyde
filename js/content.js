/* Clicksyde: puts the content the team edits in the admin panel (admin.html) on top of js/data.js.

   Live:  reads site_content + published posts from the Clicksyde Supabase project
          (supabase/migrations/20261126000000_clicksyde_admin.sql). If the tables aren't there yet,
          or Supabase is slow, the site simply uses js/data.js.
   Demo:  open any page with ?demo=1 to see the changes made in the admin's demo mode. They live in
          this browser only (localStorage) and nobody else sees them. ?demo=0 switches back.

   Loaded after data.js and before app.js. app.js waits for window.CSready before building the page. */
(function () {
  const D = window.CS;
  const D0 = JSON.parse(JSON.stringify(D)); // untouched copy of data.js, used to seed the demo and as defaults
  const DEMO_KEY = "cs-demo", VIEW_KEY = "cs-demo-view", CACHE_KEY = "cs-live-cache";

  const store = (s) => ({
    get(k) { try { return s.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { s.setItem(k, v); return true; } catch (_) { return false; } },
    del(k) { try { s.removeItem(k); } catch (_) {} }
  });
  const local = store(window.localStorage), session = store(window.sessionStorage);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* ---------- Sanitising: admin input ends up in links, image sources and styles ---------- */
  const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const httpsUrl = (u) => typeof u === "string" && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "";
  const imgSrc = (u, allowData) => {
    if (typeof u !== "string" || !u) return "";
    if (/^[\w.-]+\.(svg|png|jpe?g|webp|gif)$/i.test(u)) return "assets/clients/" + u; // file shipped in assets/clients/
    if (/^assets\/[\w./-]+$/.test(u) && !u.includes("..")) return u;
    if (allowData && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;
    return httpsUrl(u);
  };
  /* media (images or videos) for the reel, spotlight and team: site files, https uploads, demo data/IndexedDB refs */
  const mediaSrc = (u, allowDemo) => {
    if (typeof u !== "string" || !u) return "";
    if (allowDemo && /^idb:[\w-]{6,40}$/.test(u)) return u;
    return imgSrc(u, allowDemo);
  };
  const logoScale = (v) => Math.min(2.5, Math.max(0.5, Number(v) || 1));
  const plain = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

  /* Demo-mode uploads too big for localStorage (videos) live in IndexedDB; "idb:<id>" refers to one. */
  const IDB = (() => {
    const open = () => new Promise((ok, no) => {
      if (!window.indexedDB) return no(new Error("This browser can't store files for the demo."));
      const r = indexedDB.open("clicksyde-demo-media", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    const tx = (mode, fn) => open().then((db) => new Promise((ok, no) => {
      const t = db.transaction("files", mode); const req = fn(t.objectStore("files"));
      t.oncomplete = () => ok(req && req.result); t.onerror = () => no(t.error);
    }));
    const urls = {};
    return {
      put: (blob) => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); return tx("readwrite", (s) => s.put(blob, id)).then(() => "idb:" + id); },
      clear: () => tx("readwrite", (s) => s.clear()).catch(() => {}),
      resolve: (src) => {
        if (!src || !src.startsWith("idb:")) return Promise.resolve(src || "");
        const id = src.slice(4);
        if (urls[id]) return Promise.resolve(urls[id]);
        return tx("readonly", (s) => s.get(id)).then((b) => (b ? (urls[id] = URL.createObjectURL(b)) : "")).catch(() => "");
      }
    };
  })();
  window.CSmedia = IDB;

  /* Case studies: data.js keeps compact lists; the site and admin use named fields */
  const CASE_CATS = [["feedback", "Customer feedback"], ["ads", "Performance"], ["show", "Content & activations"]];
  const normCase = (c) => {
    if (!c || !Array.isArray(c.slides) || !c.slides.length || !Array.isArray(c.slides[0])) return c;
    const quote = (c.comments || []).find((m) => !m.reply) || {};
    const reply = (c.comments || []).find((m) => m.reply);
    return {
      id: c.id, client: c.client, color: c.color, tags: c.tags || [], cat: c.cat, title: c.title, sub: c.sub, published: true,
      slides: c.slides.map(([col, cap, big]) => ({ c: col, cap, big, media: "", type: "image" })),
      stats: (c.stats || []).map(([, n, l, hot]) => ({ n, l, hot: !!hot })),
      story: (c.story || []).map(([h, p]) => ({ h, p })),
      quote: { who: quote.who || c.client, role: quote.role || "", said: quote.said || "" },
      reply: reply ? reply.said : ""
    };
  };
  const cleanCase = (c, allowDemo) => ({
    id: c.id, client: plain(c.client, 80), color: isHex(c.color) ? c.color : "#2B2B2B",
    tags: (Array.isArray(c.tags) ? c.tags : []).map((t) => plain(t, 40)).filter(Boolean).slice(0, 4),
    cat: CASE_CATS.some(([k]) => k === c.cat) ? c.cat : "show",
    title: plain(c.title, 120) || plain(c.client, 80), sub: plain(c.sub, 200), published: c.published !== false,
    slides: (Array.isArray(c.slides) ? c.slides : []).slice(0, 6).map((s) => ({
      c: isHex(s.c) ? s.c : "#2B2B2B", cap: plain(s.cap, 40), big: plain(s.big, 60), media: mediaSrc(s.media, allowDemo), type: s.type === "video" ? "video" : "image" })),
    stats: (Array.isArray(c.stats) ? c.stats : []).slice(0, 4).map((s) => ({ n: plain(s.n, 14), l: plain(s.l, 60), hot: !!s.hot })).filter((s) => s.n),
    story: (Array.isArray(c.story) ? c.story : []).slice(0, 6).map((s) => ({ h: plain(s.h, 60), p: plain(s.p, 1400) })).filter((s) => s.h || s.p),
    quote: { who: plain(c.quote && c.quote.who, 80), role: plain(c.quote && c.quote.role, 80), said: plain(c.quote && c.quote.said, 700) },
    reply: plain(c.reply, 700)
  });

  const cleanContact = (c) => {
    const out = {};
    if (typeof c.email === "string" && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c.email)) out.email = c.email;
    if (typeof c.whatsapp === "string") out.whatsapp = c.whatsapp.replace(/\D/g, "").slice(0, 15);
    ["instagram", "linkedin", "x", "tiktok"].forEach((k) => { if (k in c) out[k] = httpsUrl(c[k]) || "#"; });
    return out;
  };
  /* Page copy edited on the page (js/editor.js): keep only plain text and a few inline styles */
  const INLINE = { B: 1, STRONG: 1, I: 1, EM: 1, SMALL: 1, BR: 1, SPAN: 1, A: 1 };
  const SPAN_CLASSES = ["serif", "accent", "arr"];
  const okHref = (h) => /^(https:\/\/|http:\/\/|mailto:|tel:|#|[\w.\/-]+\.html(#[\w-]+)?(\?[\w=&-]*)?$|[\w.\/-]+#[\w-]+$)/i.test(h || "");
  function cleanCopy(html) {
    const t = document.createElement("template");
    t.innerHTML = String(html || "").slice(0, 4000);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) return;
        if (n.nodeType !== 1 || !INLINE[n.tagName]) {
          if (n.nodeType === 1 && /^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|SVG)$/i.test(n.tagName)) { n.remove(); return; }
          walk(n); n.replaceWith(...Array.from(n.childNodes)); return;
        }
        walk(n);
        const keep = {};
        if (n.tagName === "SPAN") { const c = (n.getAttribute("class") || "").split(/\s+/).filter((x) => SPAN_CLASSES.includes(x)); if (c.length) keep.class = c.join(" "); }
        if (n.tagName === "A" && okHref(n.getAttribute("href"))) keep.href = n.getAttribute("href");
        if (n.getAttribute("aria-hidden") === "true") keep["aria-hidden"] = "true";
        Array.from(n.attributes).forEach((a) => n.removeAttribute(a.name));
        Object.entries(keep).forEach(([k, v]) => n.setAttribute(k, v));
        if (n.tagName === "SPAN" && !keep.class && !keep["aria-hidden"]) n.replaceWith(...Array.from(n.childNodes));
      });
    };
    walk(t.content);
    return t.innerHTML.replace(/\u00a0/g, " ").replace(/&nbsp;/g, " ").trim();
  }

  const month = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };

  function apply(site, posts, allowData) {
    if (site && typeof site === "object") {
      if (site.contact) Object.assign(D.contact, cleanContact(site.contact));
      if (Array.isArray(site.clients)) {
        D.clients = site.clients.filter((c) => c && c.n).map((c) => ({ n: String(c.n).slice(0, 80), src: imgSrc(c.logo, allowData), scale: logoScale(c.scale) }));
      }
      if (site.layout && Array.isArray(site.layout.home)) {
        D.layout = { home: site.layout.home.filter((b) => D0.layout.home.includes(b)), hidden: (site.layout.hidden || []).filter((b) => D0.layout.home.includes(b)) };
        D0.layout.home.forEach((b) => { if (!D.layout.home.includes(b)) D.layout.home.push(b); }); // new blocks added in code still show
      }
      if (site.theme && isHex(site.theme.brand)) D.theme = { brand: site.theme.brand };
      if (["s", "m", "l", "xl"].includes(site.logoSize)) D.logoSize = site.logoSize;
      if (site.finish === "luxe" || site.finish === "standard") D.finish = site.finish;
      if (site.seo && typeof site.seo === "object") {
        D.seo = {};
        Object.keys(site.seo).forEach((k) => {
          const v = site.seo[k];
          if (/^[a-z]+$/.test(k) && v && typeof v === "object") D.seo[k] = { title: plain(v.title, 70), description: plain(v.description, 170) };
        });
      }
      if (site.spotlight && typeof site.spotlight === "object") {
        const s = site.spotlight;
        D.spotlight = {
          on: !!s.on, eyebrow: plain(s.eyebrow, 60), title: plain(s.title, 160), text: plain(s.text, 600),
          media: mediaSrc(s.media, allowData), type: s.type === "video" ? "video" : "image",
          link: /^(https:\/\/|[\w.\/-]+\.html(#[\w-]+)?$)/.test(s.link || "") ? s.link : "", linkText: plain(s.linkText, 60)
        };
      }
      if (site.reel && typeof site.reel === "object") {
        D.reelVideo = mediaSrc(site.reel.video, allowData);
        if (Array.isArray(site.reel.frames) && site.reel.frames.length) {
          D.reel = site.reel.frames.slice(0, 12).map((f) => ({ c: isHex(f.c) ? f.c : "#2B2B2B", cap: plain(f.cap, 40), img: mediaSrc(f.img, allowData) }));
        }
      }
      if (Array.isArray(site.cases)) {
        D.cases = site.cases.filter((c) => c && c.published !== false && c.client && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id || "")).map((c) => cleanCase(c, allowData));
      }
      if (site.about && typeof site.about === "object") {
        const a = site.about, list = (x, n) => (Array.isArray(x) ? x : null) && x.slice(0, n);
        if (list(a.facts, 12)) D.facts = a.facts.slice(0, 12).filter((f) => f && f.q).map((f) => ({ q: plain(f.q, 80), a: plain(f.a, 300), tag: plain(f.tag, 40) }));
        if (list(a.timeline, 10)) D.timeline = a.timeline.slice(0, 10).filter((t) => t && (t.h || t.p)).map((t) => ({ y: plain(t.y, 12), h: plain(t.h, 120), p: plain(t.p, 500) }));
        if (list(a.values, 8)) D.values = a.values.slice(0, 8).filter((v) => v && v.h).map((v) => ({ i: plain(v.i, 4), h: plain(v.h, 60), p: plain(v.p, 300) }));
      }
      if (site.form && typeof site.form === "object") {
        const f = site.form, opts = (a, n) => (Array.isArray(a) ? a.map((x) => plain(x, 80)).filter(Boolean).slice(0, n) : []);
        Object.keys(D.form).forEach((k) => {
          if (Array.isArray(D.form[k])) { const o = opts(f[k], k === "needs" ? 10 : 12); if (o.length) D.form[k] = o; }
          else if (typeof f[k] === "string" && f[k].trim()) D.form[k] = plain(f[k], 300);
        });
      }
      if (Array.isArray(site.team)) {
        D.team = site.team.filter((m) => m && m.n).slice(0, 40).map((m) => ({
          n: plain(m.n, 80), r: plain(m.r, 80), odd: plain(m.odd, 160), c: isHex(m.c) ? m.c : "#171512", photo: mediaSrc(m.photo, allowData)
        }));
      }
      if (site.copy && typeof site.copy === "object") {
        D.copy = {};
        Object.keys(site.copy).forEach((k) => { if (/^[a-z]+\.\d+$/.test(k) && typeof site.copy[k] === "string") D.copy[k] = cleanCopy(site.copy[k]); });
      }
      if (Array.isArray(site.services)) {
        const strs = (a, n) => (Array.isArray(a) ? a : []).map((x) => String(x).trim().slice(0, n)).filter(Boolean).slice(0, 12);
        const seen = new Set();
        const list = site.services.filter((s) => s && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id) && s.t && !seen.has(s.id) && seen.add(s.id)).map((s, i) => ({
          id: s.id, t: String(s.t).slice(0, 80), s: String(s.s || "").slice(0, 200), body: String(s.body || "").slice(0, 2000),
          c: isHex(s.c) ? s.c : "#DDE3F6", rot: Math.max(-3, Math.min(3, Number(s.rot) || (i % 2 ? 1.5 : -1.5))), cat: String(s.cat || "show").replace(/\W/g, ""),
          get: strs(s.get, 160), for: strs(s.for, 80)
        }));
        if (list.length) D.services = list;
      }
      if (Array.isArray(site.problems)) {
        const ids = new Set(D.services.map((s) => s.id));
        D.problems = site.problems.filter((p) => p && p.p && p.h).map((p) => ({
          p: String(p.p).slice(0, 120), h: String(p.h).slice(0, 40), ids: (Array.isArray(p.ids) ? p.ids : []).filter((id) => ids.has(id))
        }));
      } else {
        const ids = new Set(D.services.map((s) => s.id));
        D.problems.forEach((p) => { p.ids = p.ids.filter((id) => ids.has(id)); });
      }
    }
    if (Array.isArray(posts)) {
      D.posts = posts.map((p) => ({
        id: String(p.id), cat: String(p.cat || "Insight"), title: String(p.title || ""), ex: String(p.ex || ""),
        mins: Math.max(1, Number(p.mins) || 1), date: p.date || month(p.published_at || p.created_at),
        color: isHex(p.color) ? p.color : "#161616", art: String(p.art || ""), image: imgSrc(p.image_url, allowData),
        featured: !!p.featured, body: Array.isArray(p.body) && p.body.length ? p.body : null
      }));
    }
  }
  // Clients from data.js use bare file names; give them a src too so app.js has one shape to render.
  D.clients = D.clients.map((c) => ({ n: c.n, src: imgSrc(c.logo, false), scale: logoScale(c.scale) }));
  D.cases = D.cases.map((c) => cleanCase(normCase(c), false));
  D.caseCats = CASE_CATS;
  D.reel = D.reel.map((f) => (Array.isArray(f) ? { c: f[0], cap: f[1], img: "" } : f));
  D.team = D.team.map((m) => Object.assign({ photo: "" }, m));
  // About page lists: data.js keeps compact [a, b, c] rows; the site and admin use named fields
  // "Let's talk" form wording: defaults here, overridden by admin > Contact form
  D.form = {
    intro: "Welcome. Four short questions, about a minute.",
    q1: "What do you need help with? Pick as many as you like.", needs: D.questions.need.slice(),
    q2: "Nice. Who are we talking to? Tell us about you and your business, like you'd text a friend.",
    nameLabel: "Your name", bizLabel: "Business or brand", aboutLabel: "Anything we should know?",
    aboutPlaceholder: "e.g. We sell skincare online and want to open a store in Abuja",
    q3: "Thanks, {name}! Roughly what budget and timeline are you working with? No wrong answers, it just helps us plan.",
    budgetLabel: "Budget", budgets: D.questions.budget.slice(), timelineLabel: "Timeline", timelineHint: "when do you need this?", timelines: D.questions.when.slice(),
    q4: "Last one. Where can we reach you? We reply within one working day.",
    contactLabel: "Email or WhatsApp number", contactPlaceholder: "you@brand.com or 0801 234 5678", send: "Send it"
  };
  D.timeline = D.timeline.map((t) => (Array.isArray(t) ? { y: t[0], h: t[1], p: t[2] } : t));
  D.values = D.values.map((v) => (Array.isArray(v) ? { i: v[0], h: v[1], p: v[2] } : v));

  /* ---------- Demo store (shared with admin.html) ---------- */
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  function seed() {
    return {
      site: { contact: clone(D0.contact), clients: clone(D0.clients), layout: clone(D0.layout), theme: { brand: "#FF4306" }, postsManaged: true },
      posts: D0.posts.map((p, i) => ({
        id: p.id, title: p.title, cat: p.cat, ex: p.ex, body: p.body || [], color: p.color, art: p.art, image_url: "",
        mins: p.mins, featured: !!p.featured, published: true, published_at: daysAgo(3 + i * 4), created_at: daysAgo(3 + i * 4)
      })),
      leads: [
        { id: "demo-1", created_at: daysAgo(0.2), name: "Sample: Adaeze O.", business: "Glow Skincare", needs: ["Turn attention into sales"], service: "Paid ads", budget: "₦500k – ₦2m / month", timeline: "This month", contact: "adaeze@example.com", about: "We sell online and want more repeat buyers.", status: "new", notes: "" },
        { id: "demo-2", created_at: daysAgo(1.5), name: "Sample: Tunde B.", business: "Bukka Express", needs: ["Get more people to know us", "Content that looks premium"], service: null, budget: "Under ₦500k / month", timeline: "Next 1–3 months", contact: "08012345678", about: "", status: "contacted", notes: "Sent intro email, waiting to hear back." },
        { id: "demo-3", created_at: daysAgo(6), name: "Sample: Ifeoma K.", business: "Lagos Run Club", needs: ["Launch something new"], service: "Events & activations", budget: "One-off project", timeline: "Yesterday 🔥", contact: "ifeoma@example.com", about: "Launching a 10k in March.", status: "proposal sent", notes: "Proposal sent on Friday." }
      ],
      subscribers: [
        { id: "demo-s1", created_at: daysAgo(0.5), email: "reader@example.com", source: "/insights.html", unsubscribed_at: null },
        { id: "demo-s2", created_at: daysAgo(4), email: "founder@example.com", source: "/insights.html", unsubscribed_at: null }
      ]
    };
  }
  const readDemo = () => { try { return JSON.parse(local.get(DEMO_KEY)) || null; } catch (_) { return null; } };
  const writeDemo = (s) => local.set(DEMO_KEY, JSON.stringify(s));
  window.CSstore = { read: readDemo, write: writeDemo, seed, reset: () => local.del(DEMO_KEY), defaults: D0, imgSrc, mediaSrc, month, cleanCopy, normCase, caseCats: CASE_CATS };

  if (document.body.dataset.page === "admin") return; // the admin panel only needs the store

  /* ---------- Which content does this visit see? ---------- */
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") session.set(VIEW_KEY, "1");
  if (params.get("demo") === "0") session.del(VIEW_KEY);
  if (params.has("fresh") || params.has("edit")) session.del(CACHE_KEY); // the admin's "View site" link: skip the cached copy
  const demo = session.get(VIEW_KEY) === "1";
  // demo previews and edit mode are never for search engines
  if (demo || params.has("edit") || params.has("fresh")) {
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
  }

  if (demo) {
    const s = readDemo() || seed();
    apply(s.site, (s.posts || []).filter((p) => p.published).sort((a, b) => (b.featured - a.featured) || (new Date(b.published_at) - new Date(a.published_at))), true);
    D.demo = true;
    // The site's forms write into the demo inbox, so a demo lead shows up in the admin panel straight away.
    window.CSdemo = {
      save(table, row) {
        const st = readDemo() || seed();
        const extra = table === "leads" ? { status: "new", notes: "" } : { unsubscribed_at: null };
        st[table] = st[table] || [];
        if (table === "subscribers" && st[table].some((x) => x.email === row.email)) return true;
        st[table].unshift(Object.assign({ id: "demo-" + Date.now().toString(36), created_at: new Date().toISOString() }, extra, row));
        return writeDemo(st);
      }
    };
    window.CSready = Promise.resolve();
    return;
  }

  // Live: use the copy cached earlier in this visit straight away, refresh it in the background.
  const useLive = (site, posts) => {
    const data = site && site[0] ? site[0].data : null;
    let p = null;
    if (Array.isArray(posts)) p = data && data.postsManaged ? posts : (posts.length ? posts : null);
    apply(data, p, false);
  };
  let cached = null;
  try { cached = JSON.parse(session.get(CACHE_KEY)); } catch (_) {}
  const sb = D.supabase || {};
  const fetchLive = () => {
    if (!sb.url || !sb.key) return Promise.resolve(null);
    const headers = { apikey: sb.key };
    if (sb.key.startsWith("eyJ")) headers.Authorization = "Bearer " + sb.key; // legacy anon key
    const base = sb.url.replace(/\/$/, "") + "/rest/v1/";
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2000);
    const get = (q) => fetch(base + q, { headers, signal: ctl.signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return Promise.all([get("site_content?id=eq.site&select=data"), get("posts?select=*&published=eq.true&order=featured.desc,published_at.desc")])
      .then(([site, posts]) => { clearTimeout(timer); return { site, posts }; });
  };
  if (cached) {
    useLive(cached.site, cached.posts);
    window.CSready = Promise.resolve();
    fetchLive().then((r) => { if (r && (r.site || r.posts)) session.set(CACHE_KEY, JSON.stringify(r)); });
  } else {
    window.CSready = fetchLive().then((r) => {
      if (!r) return;
      useLive(r.site, r.posts);
      if (r.site || r.posts) session.set(CACHE_KEY, JSON.stringify(r));
    });
  }
})();
