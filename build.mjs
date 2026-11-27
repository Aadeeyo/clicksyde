/* Clicksyde build for Netlify: `node build.mjs` writes the site to dist/.
   - copies the site as it is
   - gives every article, case study and service its own crawlable page:
       /insights/<slug>   /work/<slug>   /services/<id>
   - writes sitemap.xml with every page
   Content comes from the Clicksyde Supabase project (what the admin saved), falling back to js/data.js
   when Supabase can't be reached. Needs Node 18+ and nothing else. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");
const SITE = "https://clicksyde.com";
const today = new Date().toISOString().slice(0, 10);

/* ---------- content ---------- */
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8"), sandbox);
const D = sandbox.window.CS;

async function fetchLive() {
  const sb = D.supabase || {};
  if (!sb.url || !sb.key || process.env.SKIP_SUPABASE) return {};
  const headers = { apikey: sb.key };
  if (sb.key.startsWith("eyJ")) headers.Authorization = "Bearer " + sb.key;
  const base = sb.url.replace(/\/$/, "") + "/rest/v1/";
  const get = async (q) => {
    try {
      const r = await fetch(base + q, { headers, signal: AbortSignal.timeout(8000) });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  };
  const [site, posts] = await Promise.all([get("site_content?id=eq.site&select=data"), get("posts?select=*&published=eq.true&order=featured.desc,published_at.desc")]);
  return { site: site && site[0] ? site[0].data : null, posts };
}

const str = (v, n = 2000) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || "");
const slugOk = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s || "");
const month = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };
const isoFromLabel = (label) => { const d = new Date("1 " + label); return isNaN(d) ? today : d.toISOString().slice(0, 10); };

const normCase = (c) => {
  if (!c || !Array.isArray(c.slides) || !c.slides.length || !Array.isArray(c.slides[0])) return c;
  const quote = (c.comments || []).find((m) => !m.reply) || {}, reply = (c.comments || []).find((m) => m.reply);
  return { id: c.id, client: c.client, color: c.color, tags: c.tags || [], cat: c.cat, title: c.title, sub: c.sub, published: true,
    slides: c.slides.map(([col, cap, big]) => ({ c: col, cap, big, media: "", type: "image" })),
    stats: (c.stats || []).map(([, n, l, hot]) => ({ n, l, hot: !!hot })), story: (c.story || []).map(([h, p]) => ({ h, p })),
    quote: { who: quote.who || c.client, role: quote.role || "", said: quote.said || "" }, reply: reply ? reply.said : "" };
};

function content(live) {
  const s = live.site || {};
  let posts = D.posts.map((p) => ({ ...p, published_at: isoFromLabel(p.date) }));
  if (Array.isArray(live.posts) && (s.postsManaged || live.posts.length)) {
    posts = live.posts.map((p) => ({ id: p.id, title: p.title, cat: p.cat, ex: p.ex, mins: p.mins, date: month(p.published_at || p.created_at),
      color: p.color, art: p.art, image: p.image_url || "", featured: p.featured, body: p.body, published_at: (p.published_at || p.created_at || today).slice(0, 10),
      updated_at: (p.updated_at || p.published_at || today).slice(0, 10) }));
  }
  const cases = (Array.isArray(s.cases) ? s.cases : D.cases.map(normCase)).filter((c) => c && c.published !== false && slugOk(c.id) && c.client);
  const services = (Array.isArray(s.services) && s.services.length ? s.services : D.services).filter((x) => x && slugOk(x.id) && x.t);
  return { posts: posts.filter((p) => slugOk(p.id) && p.title), cases, services };
}

/* ---------- html helpers ---------- */
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };
const https = (u) => (/^https:\/\/[^\s"'<>]+$/.test(u || "") ? u : "");

const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const FONTS = index.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" rel="stylesheet">/)[0];
const CSS = index.match(/css\/clicksyde\.css\?v=\d+/)[0];
const SCRIPTS = index.match(/<script src="js\/data\.js[\s\S]*?<script src="js\/app\.js[^"]*"><\/script>/)[0];

function page({ urlPath, title, description, image, ogType = "article", jsonld, body, dataPage }) {
  const url = SITE + urlPath;
  const img = https(image) || SITE + "/assets/share.jpg";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <base href="/">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Clicksyde">
  <meta property="og:locale" content="en_NG">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(img)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(img)}">
  <meta name="theme-color" content="#171512">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/logo-512.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${FONTS}
  <link rel="stylesheet" href="${CSS}">
  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>
</head>
<body data-page="${dataPage}">
<main>
${body}
</main>
${SCRIPTS}
</body>
</html>
`;
}

const ORG = { "@type": "Organization", "@id": SITE + "/#organization", name: "Clicksyde", url: SITE + "/", logo: SITE + "/assets/logo-512.png" };
const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + item })) });
const crumbHtml = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([n, h], i) => i < items.length - 1 ? `<a href="${h.replace(/^\//, "") || "./"}">${esc(n)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(n)}</span>`).join("")}</nav>`;
const ctaBlock = (h, p, href = "start.html#talk", label = "Let's talk") => `<section class="gen-cta"><div class="wrap"><h2 class="h-md">${h}</h2><p class="lead">${esc(p)}</p><a class="btn btn-brand" href="${href}">${esc(label)} <span class="arr">→</span></a></div></section>`;

/* ---------- pages ---------- */
function articlePage(p, all) {
  const body = Array.isArray(p.body) && p.body.length ? p.body : [["p", p.ex]];
  const more = all.filter((x) => x.id !== p.id).slice(0, 3);
  const urlPath = `/insights/${p.id}`;
  const c = [["Home", "/"], ["Insights", "/insights"], [p.title, urlPath]];
  return page({
    urlPath, title: `${clip(p.title, 56)} | Clicksyde`, description: clip(p.ex || body.map((b) => b[1]).join(" "), 158), image: p.image, dataPage: "article",
    jsonld: { "@context": "https://schema.org", "@graph": [
      { "@type": "Article", headline: clip(p.title, 110), description: p.ex, image: https(p.image) || SITE + "/assets/share.jpg", datePublished: p.published_at, dateModified: p.updated_at || p.published_at,
        author: ORG, publisher: ORG, mainEntityOfPage: SITE + urlPath, articleSection: p.cat, inLanguage: "en-NG" }, crumbs(c)] },
    body: `  <article class="gen-page gen-article">
    <div class="wrap gen-narrow">
      ${crumbHtml(c)}
      <div class="post-meta"><span class="cat">${esc(p.cat)}</span><span>${esc(p.mins)} min read</span><span>·</span><time datetime="${esc(p.published_at)}">${esc(p.date || month(p.published_at))}</time></div>
      <h1 class="h-lg">${esc(p.title)}</h1>
      ${p.ex ? `<p class="lead">${esc(p.ex)}</p>` : ""}
    </div>
    ${https(p.image) ? `<figure class="wrap gen-cover"><img src="${esc(p.image)}" alt="${esc(p.title)}"></figure>` : `<div class="wrap gen-cover"><div class="gen-art" style="background:${isHex(p.color) ? p.color : "#171512"}">${esc(p.art || "")}</div></div>`}
    <div class="wrap gen-narrow gen-body">
      ${body.map(([t, x]) => t === "h" ? `<h2>${esc(x)}</h2>` : t === "q" ? `<blockquote>${esc(x)}</blockquote>` : `<p>${esc(x)}</p>`).join("\n      ")}
    </div>
  </article>
  ${more.length ? `<section class="gen-more"><div class="wrap"><h2 class="h-md">More from Insights</h2><div class="gen-cards">${more.map((m) => `<a class="gen-card" href="insights/${m.id}"><span class="post-meta"><span class="cat">${esc(m.cat)}</span></span><b>${esc(m.title)}</b><span class="muted">${esc(m.ex)}</span></a>`).join("")}</div></div></section>` : ""}
  ${ctaBlock("Want this kind of thinking on <span class=\"serif accent\">your</span> brand?", "Tell us what you're working on. A strategist replies within one working day.")}`
  });
}

function casePage(c, all) {
  const urlPath = `/work/${c.id}`;
  const crumbsList = [["Home", "/"], ["Work", "/work"], [c.client, urlPath]];
  const slide = (c.slides || []).find((s) => https(s.media) && s.type !== "video");
  const others = all.filter((x) => x.id !== c.id).slice(0, 3);
  return page({
    urlPath, title: `${clip(c.client, 36)} Case Study | Clicksyde`, description: clip(`${c.sub || ""} ${(c.story || []).map((s) => s.p).join(" ")}`, 158), image: slide && slide.media, dataPage: "case",
    jsonld: { "@context": "https://schema.org", "@graph": [
      { "@type": "Article", headline: clip(`${c.client}: ${c.sub || c.title}`, 110), description: c.sub, image: (slide && slide.media) || SITE + "/assets/share.jpg",
        author: ORG, publisher: ORG, mainEntityOfPage: SITE + urlPath, about: { "@type": "Organization", name: c.client }, keywords: (c.tags || []).join(", ") }, crumbs(crumbsList)] },
    body: `  <article class="gen-page gen-case">
    <div class="wrap gen-narrow">
      ${crumbHtml(crumbsList)}
      <span class="eyebrow">Case study · ${esc((c.tags || []).join(" · "))}</span>
      <h1 class="h-lg">${esc(c.client)}</h1>
      ${c.sub ? `<p class="lead">${esc(c.sub)}</p>` : ""}
    </div>
    <div class="wrap gen-cover"><div class="gen-art" style="background:linear-gradient(150deg, ${isHex((c.slides[0] || {}).c) ? c.slides[0].c : c.color}, #171512 140%)">
      ${slide ? `<img src="${esc(slide.media)}" alt="${esc(c.client + (slide.cap ? ": " + slide.cap : ""))}">` : `<span>${esc(((c.slides[0] || {}).big || c.client).replace(/\n/g, " "))}</span>`}</div></div>
    ${(c.stats || []).length ? `<div class="wrap"><div class="stats gen-stats">${c.stats.map((s) => `<div class="stat ${s.hot ? "hot" : ""}"><b>${esc(s.n)}</b><span>${esc(s.l)}</span></div>`).join("")}</div></div>` : ""}
    <div class="wrap gen-narrow gen-body">
      ${(c.story || []).map((s) => `${s.h ? `<h2>${esc(s.h)}</h2>` : ""}<p>${esc(s.p)}</p>`).join("\n      ")}
      ${c.quote && c.quote.said ? `<blockquote>${esc(c.quote.said)}<cite>${esc(c.quote.who || c.client)}${c.quote.role ? `, ${esc(c.quote.role)}` : ""}</cite></blockquote>` : ""}
    </div>
  </article>
  ${others.length ? `<section class="gen-more"><div class="wrap"><h2 class="h-md">More work</h2><div class="gen-cards">${others.map((o) => `<a class="gen-card" href="work/${o.id}"><b>${esc(o.client)}</b><span class="muted">${esc(o.sub || "")}</span></a>`).join("")}</div></div></section>` : ""}
  ${ctaBlock("Want results like <span class=\"serif accent\">these?</span>", "Tell us about your brand and what you want to move. We reply within one working day.")}`
  });
}

function servicePage(s, all, problems) {
  const urlPath = `/services/${s.id}`;
  const crumbsList = [["Home", "/"], ["Services", "/services"], [s.t, urlPath]];
  const fixes = (problems || []).filter((p) => (p.ids || []).includes(s.id)).map((p) => p.p);
  const others = all.filter((x) => x.id !== s.id);
  return page({
    urlPath, title: clip(`${s.t} in Lagos | Clicksyde`, 70), description: clip(`${s.s} ${s.body || ""}`, 158), dataPage: "service", ogType: "website",
    jsonld: { "@context": "https://schema.org", "@graph": [
      { "@type": "Service", name: s.t, serviceType: s.t, description: s.body || s.s, provider: { "@id": SITE + "/#organization" },
        areaServed: { "@type": "Country", name: "Nigeria" }, url: SITE + urlPath }, crumbs(crumbsList)] },
    body: `  <article class="gen-page gen-service">
    <div class="wrap gen-narrow">
      ${crumbHtml(crumbsList)}
      <span class="eyebrow">Service</span>
      <h1 class="h-lg">${esc(s.t)}</h1>
      <p class="lead">${esc(s.s)}</p>
    </div>
    <div class="wrap gen-narrow gen-body">
      ${s.body ? `<p>${esc(s.body)}</p>` : ""}
      ${(s.get || []).length ? `<h2>What you get</h2><ul>${s.get.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
      ${(s.for || []).length ? `<h2>Great for</h2><ul>${s.for.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
      ${fixes.length ? `<h2>Problems it solves</h2><ul>${fixes.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      <p><a class="btn btn-brand" href="start.html?service=${s.id}#talk">I need this <span class="arr">→</span></a></p>
    </div>
  </article>
  <section class="gen-more"><div class="wrap"><h2 class="h-md">Other services</h2><div class="gen-cards">${others.map((o) => `<a class="gen-card" href="services/${o.id}"><b>${esc(o.t)}</b><span class="muted">${esc(o.s)}</span></a>`).join("")}</div></div></section>
  ${ctaBlock("Not sure which one you <span class=\"serif accent\">need?</span>", "Tell us the problem and we'll point you to the right fix.")}`
  });
}

/* ---------- build ---------- */
const SKIP = new Set(["dist", "node_modules", "supabase", ".git", ".github", "build.mjs", "netlify.toml", "README.md", "package.json", "package-lock.json"]);
function copy(src, dst) {
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const a = path.join(src, name), b = path.join(dst, name);
    if (fs.statSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, b); } else fs.copyFileSync(a, b);
  }
}

const live = await fetchLive();
const C = content(live);
const problems = (live.site && Array.isArray(live.site.problems)) ? live.site.problems : D.problems;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
copy(ROOT, OUT);

const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
C.posts.forEach((p) => write(`insights/${p.id}.html`, articlePage(p, C.posts)));
C.cases.forEach((c) => write(`work/${c.id}.html`, casePage(c, C.cases)));
C.services.forEach((s) => write(`services/${s.id}.html`, servicePage(s, C.services, problems)));

const urls = [["/", "weekly", "1.0"], ["/services", "monthly", "0.9"], ["/work", "weekly", "0.9"], ["/insights", "weekly", "0.9"], ["/about", "monthly", "0.7"], ["/start", "monthly", "0.7"],
  ...C.services.map((s) => [`/services/${s.id}`, "monthly", "0.8"]),
  ...C.cases.map((c) => [`/work/${c.id}`, "monthly", "0.7"]),
  ...C.posts.map((p) => [`/insights/${p.id}`, "monthly", "0.7", p.updated_at || p.published_at])];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, f, pr, mod]) => `  <url><loc>${SITE}${u}</loc><lastmod>${mod || today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join("\n")}
</urlset>
`);

console.log(`Built dist/ from ${live.site || live.posts ? "Supabase + data.js" : "data.js (Supabase not reachable)"}: ${C.posts.length} articles, ${C.cases.length} case studies, ${C.services.length} services, ${urls.length} URLs in the sitemap.`);
