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
  const cleanContact = (c) => {
    const out = {};
    if (typeof c.email === "string" && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c.email)) out.email = c.email;
    if (typeof c.whatsapp === "string") out.whatsapp = c.whatsapp.replace(/\D/g, "").slice(0, 15);
    ["instagram", "linkedin", "x", "tiktok"].forEach((k) => { if (k in c) out[k] = httpsUrl(c[k]) || "#"; });
    return out;
  };
  const month = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };

  function apply(site, posts, allowData) {
    if (site && typeof site === "object") {
      if (site.contact) Object.assign(D.contact, cleanContact(site.contact));
      if (Array.isArray(site.clients)) {
        D.clients = site.clients.filter((c) => c && c.n).map((c) => ({ n: String(c.n).slice(0, 80), src: imgSrc(c.logo, allowData) }));
      }
      if (site.layout && Array.isArray(site.layout.home)) {
        D.layout = { home: site.layout.home.filter((b) => D0.layout.home.includes(b)), hidden: (site.layout.hidden || []).filter((b) => D0.layout.home.includes(b)) };
        D0.layout.home.forEach((b) => { if (!D.layout.home.includes(b)) D.layout.home.push(b); }); // new blocks added in code still show
      }
      if (site.theme && isHex(site.theme.brand)) D.theme = { brand: site.theme.brand };
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
  D.clients = D.clients.map((c) => ({ n: c.n, src: imgSrc(c.logo, false) }));

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
  window.CSstore = { read: readDemo, write: writeDemo, seed, reset: () => local.del(DEMO_KEY), defaults: D0, imgSrc, month };

  if (document.body.dataset.page === "admin") return; // the admin panel only needs the store

  /* ---------- Which content does this visit see? ---------- */
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") session.set(VIEW_KEY, "1");
  if (params.get("demo") === "0") session.del(VIEW_KEY);
  if (params.has("fresh")) session.del(CACHE_KEY); // the admin's "View site" link: skip the cached copy
  const demo = session.get(VIEW_KEY) === "1";

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
