/* Clicksyde: site shell + page behaviour.
   Every page sets <body data-page="home|wall|work|insights|about|talk">.
   The shell (header, story menu, dock, next-chapter link, footer) is built here so the
   chapters always link to each other in the same order. */
(window.CSready || Promise.resolve()).then(function () {
  const D = window.CS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const page = document.body.dataset.page;
  const chapters = D.chapters;
  const idx = chapters.findIndex((c) => c.id === page);
  const current = chapters[idx];

  /* Page copy edited on the page (admin → Page copy). The original wording is kept for "Original wording". */
  window.CScopyOriginal = {};
  $$("[data-copy]").forEach((el) => {
    const k = el.dataset.copy;
    window.CScopyOriginal[k] = el.innerHTML;
    if (D.copy && typeof D.copy[k] === "string" && D.copy[k]) el.innerHTML = D.copy[k];
  });

  /* Search titles and descriptions set in the admin (SEO) */
  const seo = D.seo && D.seo[page];
  if (seo) {
    const set = (sel, attr, v) => { const el = document.querySelector(sel); if (el && v) el.setAttribute(attr, v); };
    if (seo.title) { document.title = seo.title; set('meta[property="og:title"]', "content", seo.title); set('meta[name="twitter:title"]', "content", seo.title); }
    if (seo.description) ["meta[name=description]", 'meta[property="og:description"]', 'meta[name="twitter:description"]'].forEach((s) => set(s, "content", seo.description));
  }

  /* Finish chosen in the admin (Layout & brand): Standard or Luxe. ?luxe=1 / ?luxe=0 previews either without saving. */
  const qsLuxe = new URLSearchParams(location.search).get("luxe");
  const luxe = qsLuxe === "1" || (qsLuxe !== "0" && D.finish === "luxe");
  document.documentElement.classList.toggle("luxe", luxe);

  /* Brand colour chosen in the admin panel (Layout & brand) */
  if (D.theme && D.theme.brand && D.theme.brand.toUpperCase() !== "#FF4306") {
    const r = document.documentElement.style;
    r.setProperty("--brand", D.theme.brand);
    r.setProperty("--brand-ink", `color-mix(in srgb, ${D.theme.brand} 82%, #000)`);
    r.setProperty("--brand-soft", `color-mix(in srgb, ${D.theme.brand} 14%, #fff)`);
  }

  /* ---------- Official Clicksyde logo (js/logo.js, taken from clicksyde.com) ---------- */
  const mark = (fg = "#FF4306") => window.CSlogo.mark(fg);
  const logo = (wordFg) => window.CSlogo.full("#FF4306", wordFg);
  window.CSmark = mark;

  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/></svg>',
    wall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>',
    work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4-4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
  };

  /* ---------- Header ---------- */
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html" aria-label="Clicksyde home">${logo()}</a>
      ${page !== "talk" ? `<a class="btn btn-dark header-cta" href="start.html"><span class="dot"></span>Let's talk</a>` : `<span class="header-cta"></span>`}
      <button class="menu-btn" aria-label="Open the story menu" aria-expanded="false" aria-controls="story-menu"><span></span></button>
    </div>
    <div class="progress" aria-hidden="true"></div>`;
  document.body.prepend(header);

  /* ---------- Story menu: the table of contents of the storybook ---------- */
  const menu = document.createElement("nav");
  menu.className = "story-menu"; menu.id = "story-menu"; menu.setAttribute("aria-label", "Menu");
  menu.innerHTML = `
    <div class="top"><a class="brand" href="index.html" aria-label="Clicksyde home" style="color:var(--ivory)">${logo()}</a>
      <button class="close" aria-label="Close menu">✕</button></div>
    <ol>${chapters.map((c) => `
      <li><a href="${c.href}" ${c.id === page ? 'aria-current="page"' : ""}>
        <span class="t">${esc(c.title)}</span>
        <span class="q">${esc(c.q)}</span></a></li>`).join("")}
    </ol>
    <div class="menu-foot">
      <a class="btn btn-brand" href="start.html">Let's talk <span class="arr">→</span></a>
      <a class="btn btn-ghost" href="mailto:${D.contact.email}">${D.contact.email}</a>
    </div>`;
  document.body.appendChild(menu);
  const menuBtn = $(".menu-btn", header);
  const setMenu = (open) => {
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $(".close", menu).focus(); else menuBtn.focus();
  };
  menuBtn.addEventListener("click", () => setMenu(true));
  $(".close", menu).addEventListener("click", () => setMenu(false));

  /* ---------- Dock ---------- */
  const dock = document.createElement("nav");
  dock.className = "dock"; dock.setAttribute("aria-label", "Main");
  dock.innerHTML = chapters.map((c) => `
    <a href="${c.href}" class="${c.id === "talk" ? "go" : ""}" ${c.id === page ? 'aria-current="page"' : ""} aria-label="${esc(c.label)}" title="${esc(c.label)}">
      ${icons[c.id]}<span class="lbl">${esc(c.label)}</span></a>`).join("");
  document.body.appendChild(dock);


  /* ---------- Turn the page: every chapter ends by pointing to the next one ---------- */
  const main = $("main");
  if (current && current.id !== "talk") {
    const next = chapters[idx + 1];
    const custom = $("[data-next-line]");
    const line = custom ? custom.dataset.nextLine : next.q;
    const turn = document.createElement("section");
    turn.className = "turn";
    turn.innerHTML = `<div class="wrap"><a href="${next.href}">
      <div><div class="k">Up next</div>
      <div class="t">${esc(next.title)}</div><p class="s">${esc(line)}</p></div>
      <span class="circle" aria-hidden="true">→</span></a></div>`;
    main.appendChild(turn);
  }

  /* ---------- Footer ---------- */
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap">
    <div class="cols">
      <div><a class="brand" href="index.html" aria-label="Clicksyde home">${logo()}</a>
        <p class="muted" style="max-width:32ch;margin-top:14px">We make brands impossible to overlook.</p></div>
      <div><h4>Explore</h4><ul>${chapters.map((c) => `<li><a href="${c.href}">${esc(c.title)}</a></li>`).join("")}</ul></div>
      <div><h4>Start</h4><ul>
        <li><a href="start.html">Request a proposal</a></li>
        <li><a href="mailto:${D.contact.email}">${D.contact.email}</a></li></ul></div>
      <div><h4>Follow</h4><ul>
        ${[["instagram", "Instagram"], ["linkedin", "LinkedIn"], ["x", "X"], ["tiktok", "TikTok"]].map(([k, t]) =>
          `<li><a href="${esc(D.contact[k])}" target="_blank" rel="noopener">${t}</a></li>`).join("")}</ul></div>
    </div>
    <div class="legal"><span>© ${new Date().getFullYear()} Clicksyde. All rights reserved.</span><span>Lagos, Nigeria</span></div>
  </div>`;
  document.body.appendChild(footer);

  /* ---------- Global: Escape closes overlays, scroll progress, reveal on scroll ---------- */
  const overlays = [];
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (menu.classList.contains("open")) return setMenu(false);
    overlays.forEach((close) => close());
  });

  const bar = $(".progress", header);
  const darkHero = $(".hero:not(.sh-card)");
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
    if (darkHero) header.classList.toggle("on-dark", scrollY < darkHero.offsetHeight - 80);
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  const observe = () => $$(".rv:not(.in)").forEach((el) => io.observe(el));

  /* count-up for numbers marked data-count */
  const countIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, raw = el.textContent, m = raw.match(/[\d.]+/);
    if (!m || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = parseFloat(m[0]), dec = (m[0].split(".")[1] || "").length, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1200), v = (end * (1 - Math.pow(1 - p, 3))).toFixed(dec);
      el.textContent = raw.replace(m[0], v);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.5 });

  /* =====================================================
     Page renderers
     ===================================================== */
  const R = {};

  /* ----- 01 HOME ----- */
  R.home = () => {
    // Split hero: the wordmark halves part as you scroll and the reel card grows in between
    const sh = $(".split-hero");
    if (sh) {
      const halves = $$(".sh-half", sh);
      const fit = () => {
        const t = $("text", halves[0]);
        const box = t.getBBox();
        // exact cap height, so the split runs through the middle of the letters
        const c = document.createElement("canvas").getContext("2d");
        const cs = getComputedStyle(t);
        c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        try { c.fontStretch = "extra-condensed"; } catch (_) {}
        const m = c.measureText("CLICKSYDE");
        const asc = m.actualBoundingBoxAscent || box.height * .72, desc = m.actualBoundingBoxDescent || 0;
        halves.forEach((svg) => svg.setAttribute("viewBox", `${box.x} ${-asc} ${box.width} ${asc + desc}`));
      };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fit);
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) sh.classList.add("still");
      const split = () => {
        if (still) return;
        const r = sh.getBoundingClientRect();
        const run = sh.offsetHeight - $(".sh-stage", sh).offsetHeight;
        const p = Math.min(1, Math.max(0, -r.top / (run || 1)));
        sh.style.setProperty("--p", p.toFixed(4));
        sh.classList.toggle("open", p > .55);
      };
      addEventListener("scroll", split, { passive: true }); addEventListener("resize", split); split();
    }
    // Reel: use assets/reel.mp4 if present, otherwise a calm wall of campaign frames
    const reel = $(".hero-reel");
    const cols = window.innerWidth >= 900 ? 4 : 2;
    let wall = '<div class="reel-wall" aria-hidden="true">';
    for (let c = 0; c < cols; c++) {
      const frames = D.reel.slice(c * 2).concat(D.reel.slice(0, c * 2)).slice(0, 4);
      const list = frames.concat(frames); // doubled for a seamless loop
      wall += `<div class="reel-col" style="animation-delay:${-c * 11}s">${list.map((f) =>
        `<div class="frame${f.img ? " has-img" : ""}" style="background:linear-gradient(165deg, ${f.c}, ${f.c}bb 55%, #171512)">${f.img ? `<img data-media="${esc(f.img)}" alt="">` : ""}${f.cap ? `<span>${esc(f.cap)}</span>` : ""}</div>`).join("")}</div>`;
    }
    reel.insertAdjacentHTML("afterbegin", wall + "</div>");
    const v = $("video", reel);
    if (v && D.reelVideo) {
      // the admin's uploaded reel replaces assets/reel.mp4
      $$("source", v).forEach((s) => s.remove());
      window.CSmedia.resolve(D.reelVideo).then((u) => { if (!u) return v.remove(); v.src = u; v.load(); v.play().catch(() => {}); });
    }
    if (v) {
      v.addEventListener("loadeddata", () => { $(".reel-wall", reel).remove(); }, { once: true });
      v.addEventListener("error", () => v.remove(), true);
      $$("source", v).forEach((s) => s.addEventListener("error", () => v.remove()));
    }

    // Spotlight: one featured campaign, switched on in the admin
    const sp = $(".spotlight");
    if (sp) {
      const s = D.spotlight || {};
      const show = s.on && (s.title || s.media) && !((D.layout && D.layout.hidden) || []).includes("spotlight");
      sp.hidden = !show;
      if (show) {
        $(".spot-eyebrow", sp).textContent = s.eyebrow || "Spotlight";
        $(".spot-title", sp).textContent = s.title;
        $(".spot-text", sp).textContent = s.text;
        const a = $(".spot-link", sp);
        if (s.link && s.linkText) { a.href = s.link; a.textContent = s.linkText; a.hidden = false; }
        $(".spot-media", sp).innerHTML = !s.media ? "" : s.type === "video"
          ? `<video data-media="${esc(s.media)}" muted loop playsinline autoplay controls preload="metadata"></video>`
          : `<img data-media="${esc(s.media)}" alt="${esc(s.title)}">`;
        sp.classList.toggle("no-media", !s.media);
      }
    }

    // Logo slideshow
    // The track scrolls by half its width, so each half must be wider than the widest screen: repeat short lists.
    if (D.clients.length) {
      $(".marquee").classList.add("size-" + (D.logoSize || "m"));
      const one = D.clients.map((c) => c.src
        ? `<img src="${esc(c.src)}" alt="${esc(c.n)}" loading="lazy" style="--s:${c.scale || 1}">`
        : `<span>${esc(c.n)}</span>`).join("");
      const half = one.repeat(Math.max(1, Math.ceil(12 / D.clients.length)));
      $(".marquee-track").innerHTML = half + half;
    } else $(".marquee").hidden = true;

    // One-liner lights up word by word as you scroll past it
    const ol = $(".oneliner p");
    ol.innerHTML = ol.textContent.trim().split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
    const words = $$(".w", ol);
    const lightUp = () => {
      const r = ol.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      words.forEach((w, i) => w.classList.toggle("lit", i < p * words.length));
    };
    addEventListener("scroll", lightUp, { passive: true }); lightUp();

    // "Is this for me?" check
    const checks = $$(".check");
    const verdict = $(".fit-verdict");
    checks.forEach((b) => b.addEventListener("click", () => {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
      const n = checks.filter((c) => c.getAttribute("aria-pressed") === "true").length;
      verdict.classList.toggle("on", n > 0);
      $(".fit-text", verdict).textContent = n === 0 ? "Tick what sounds like you." : n === 1 ? "One is enough. We should talk." : `${n} out of ${checks.length}. We should definitely talk.`;
    }));
  };

  /* ----- 02 THE WALL ----- */
  R.wall = () => {
    const wall = $(".wall");
    wall.innerHTML = D.services.map((s, i) => `
      <button class="note rv rv-d${i % 3}" style="--c:${s.c};--rot:${s.rot}deg" data-id="${s.id}" data-cat="${s.cat}" aria-haspopup="dialog">
        <span class="no">${String(i + 1).padStart(2, "0")}</span><span class="tap" aria-hidden="true">+</span>
        <span class="nt">${esc(s.t)}</span><span class="ns">${esc(s.s)}</span>
      </button>`).join("");

    // the open note
    const wrap = $(".sheet-wrap");
    const sheet = $(".sheet", wrap);
    let open = -1, opener = null;
    const show = (i) => {
      open = (i + D.services.length) % D.services.length;
      const s = D.services[open];
      sheet.style.setProperty("--c", s.c);
      sheet.innerHTML = `<button class="x" aria-label="Close">✕</button>
        <span class="no" style="font-weight:700;opacity:.55">${String(open + 1).padStart(2, "0")} / ${String(D.services.length).padStart(2, "0")}</span>
        <h3 id="sheet-title">${esc(s.t)}</h3><div class="ns">${esc(s.s)}</div>
        <p class="body">${esc(s.body)}</p>
        <h4>What you get</h4><ul>${s.get.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
        <h4>Great for</h4><div class="tags">${s.for.map((g) => `<span>${esc(g)}</span>`).join("")}</div>
        <div class="acts"><a class="btn btn-dark" href="start.html?service=${s.id}">I need this <span class="arr">→</span></a>
          <a class="btn btn-ghost" href="work.html">See it in action</a></div>
        <div class="nav"><button data-go="-1">← Previous note</button><button data-go="1">Next note →</button></div>`;
      $(".x", sheet).onclick = hide;
      $$("[data-go]", sheet).forEach((b) => (b.onclick = () => show(open + Number(b.dataset.go))));
      wrap.classList.add("open"); document.body.style.overflow = "hidden";
      history.replaceState(null, "", "#" + s.id);
      $(".x", sheet).focus();
    };
    const hide = () => {
      if (!wrap.classList.contains("open")) return;
      wrap.classList.remove("open"); document.body.style.overflow = "";
      history.replaceState(null, "", location.pathname + location.search);
      if (opener) opener.focus();
    };
    overlays.push(hide);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) hide(); });
    wall.addEventListener("click", (e) => {
      const n = e.target.closest(".note"); if (!n) return;
      opener = n; show(D.services.findIndex((s) => s.id === n.dataset.id));
    });
    const fromHash = D.services.findIndex((s) => "#" + s.id === location.hash);
    if (fromHash > -1) setTimeout(() => show(fromHash), 400);

    // problem finder highlights the notes that solve it
    const finder = $(".finder");
    finder.innerHTML = D.problems.map((p, i) => `<button class="prob" data-i="${i}"><span>${esc(p.p)}<small>${esc(p.h)}</small></span><span aria-hidden="true">↗</span></button>`).join("");
    const chips = $(".filters");
    chips.innerHTML = `<button class="chip" aria-pressed="true" data-f="all">Everything</button>` +
      D.problems.map((p, i) => `<button class="chip" aria-pressed="false" data-f="${i}">${esc(p.h)}</button>`).join("");
    const filter = (f) => {
      $$(".chip", chips).forEach((c) => c.setAttribute("aria-pressed", c.dataset.f === String(f)));
      const ids = f === "all" ? null : D.problems[f].ids;
      $$(".note", wall).forEach((n) => n.classList.toggle("dim", !!ids && !ids.includes(n.dataset.id)));
    };
    chips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) filter(c.dataset.f); });
    finder.addEventListener("click", (e) => {
      const b = e.target.closest(".prob"); if (!b) return;
      filter(Number(b.dataset.i));
      $(".wall-sec").scrollIntoView({ behavior: "smooth" });
    });
  };

  /* ----- 03 WORK: feed of case studies, each followed by the client's comments ----- */
  R.work = () => {
    const initials = (name) => esc(String(name || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase());
    if (!D.cases.length) {
      $(".jump").innerHTML = ""; $(".feed-filters").innerHTML = "";
      $(".feed").innerHTML = `<p class="lead">New case studies are on the way. <a href="start.html">Start a project</a> and you could be next.</p>`;
      return;
    }
    $(".jump").innerHTML = D.cases.map((c) => `
      <a href="#${esc(c.id)}"><span class="th" style="background:linear-gradient(135deg, ${(c.slides[0] || {}).c || c.color}, ${c.color})"></span>
      <span><b>${esc(c.client)}</b><small>${esc(c.sub)}</small></span><span aria-hidden="true">↓</span></a>`).join("");

    const used = new Set(D.cases.map((c) => c.cat));
    const cats = [["all", "All work"], ...D.caseCats.filter(([k]) => used.has(k))];
    $(".feed-filters").innerHTML = cats.length > 2 ? cats.map(([k, l], i) => `<button class="chip" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join("") : "";

    $(".feed").innerHTML = D.cases.map((c, ci) => `
      <article class="case rv" id="${esc(c.id)}" data-cat="${c.cat}">
        ${c.slides.length ? `<div class="carousel">
          <div class="slides" tabindex="0" aria-label="${esc(c.client)} images">${c.slides.map((sl) => `
            <div class="slide${sl.media ? " has-media" : ""}" style="background:linear-gradient(150deg, ${sl.c}, #161616 140%)">
              ${sl.media ? (sl.type === "video" ? `<video class="slide-media" data-media="${esc(sl.media)}" muted loop playsinline autoplay preload="metadata"></video>` : `<img class="slide-media" data-media="${esc(sl.media)}" alt="${esc(c.client + (sl.cap ? ": " + sl.cap : ""))}">`) : ""}
              ${sl.big ? `<div class="big">${esc(sl.big).replace(/\n/g, "<br>")}</div>` : ""}${sl.cap ? `<span class="cap">${esc(sl.cap)}</span>` : ""}</div>`).join("")}
          </div>
          ${c.slides.length > 1 ? `<div class="dots">${c.slides.map((_, i) => `<button aria-label="Image ${i + 1}" aria-current="${i === 0}"></button>`).join("")}</div>` : ""}
        </div>` : ""}
        <div class="case-body">
          <div class="byline">
            <div class="avatars"><span>${mark()}</span><span style="background:${c.color}">${initials(c.client)}</span></div>
            <div><b>Clicksyde</b> <span class="with">with</span> <b>${esc(c.client)}</b>
              <div class="meta">${c.tags.map(esc).join(" · ")}</div></div>
          </div>
          <h2>${esc(c.title)}</h2>${c.sub ? `<p class="sub">${esc(c.sub)}</p>` : ""}
          ${c.stats.length ? `<div class="stats">${c.stats.map((st) => `<div class="stat ${st.hot ? "hot" : ""}"><b data-count>${esc(st.n)}</b><span>${esc(st.l)}</span></div>`).join("")}</div>` : ""}
          ${c.story.length ? `<button class="btn story-toggle" aria-expanded="false" aria-controls="story-${ci}">Read the full story <span aria-hidden="true">＋</span></button>
          <div class="story" id="story-${ci}"><div>${c.story.map((st) => `<div class="chunk">${st.h ? `<h4>${esc(st.h)}</h4>` : ""}<p>${esc(st.p)}</p></div>`).join("")}</div></div>` : ""}
        </div>
        ${c.quote.said ? `<div class="thread" aria-label="Client feedback">
          <div class="th-head"><span>In the client's words</span></div>
          <div class="comment">
            <div class="av" style="background:${c.color}">${initials(c.quote.who || c.client)}</div>
            <div><div class="who"><b>${esc(c.quote.who || c.client)}</b>${c.quote.role ? `<span class="role">${esc(c.quote.role)}</span>` : ""}<span class="pin">Client</span></div>
              <p class="said">${esc(c.quote.said)}</p></div>
          </div>
          ${c.reply ? `<div class="comment reply">
            <div class="av">${mark()}</div>
            <div><div class="who"><b>Clicksyde</b><span class="role">Replying</span></div><p class="said">${esc(c.reply)}</p></div>
          </div>` : ""}
          <div class="add-comment"><a href="start.html">Want a comment like this? Start your project →</a></div>
        </div>` : ""}
      </article>`).join("");

    // carousel dots follow the swipe
    $$(".carousel").forEach((car) => {
      const track = $(".slides", car), dots = $$(".dots button", car);
      track.addEventListener("scroll", () => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((d, j) => d.setAttribute("aria-current", i === j));
      }, { passive: true });
      dots.forEach((d, j) => d.addEventListener("click", () => track.scrollTo({ left: j * track.clientWidth, behavior: "smooth" })));
    });
    $$(".story-toggle").forEach((b) => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", open);
      $("#" + b.getAttribute("aria-controls")).classList.toggle("open", open);
      b.lastElementChild.textContent = open ? "−" : "＋";
    }));
    $(".feed-filters").addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      $$(".feed-filters .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
      $$(".case").forEach((a) => (a.style.display = c.dataset.f === "all" || a.dataset.cat === c.dataset.f ? "" : "none"));
    });
  };

  /* ----- 04 INSIGHTS ----- */
  R.insights = () => {
    if (!D.posts.length) {
      $(".featured-slot").innerHTML = `<p class="lead">New articles are on the way. Join the newsletter below and get the first one in your inbox.</p>`;
      return;
    }
    const art = (p, big) => p.image ? `<img class="cover" src="${esc(p.image)}" alt="${esc(p.title)}">` : big ? `<span class="big">${esc(p.art)}</span>` : esc(p.art);
    const f = D.posts.find((p) => p.featured) || D.posts[0];
    const meta = (p) => `<div class="post-meta"><span class="cat">${esc(p.cat)}</span><span>${p.mins} min read</span><span>·</span><span>${esc(p.date)}</span></div>`;
    $(".featured-slot").innerHTML = `<button class="featured rv" data-id="${esc(f.id)}">
      <div class="art" style="background:${f.color}">${art(f, true)}</div>
      <div class="txt">${meta(f)}<h2>${esc(f.title)}</h2><p class="muted" style="margin:0">${esc(f.ex)}</p>
      <span class="btn btn-dark" style="align-self:flex-start;margin-top:8px">Read it <span class="arr">→</span></span></div></button>`;
    const rest = D.posts.filter((p) => p !== f);
    const cats = ["All", ...new Set(D.posts.map((p) => p.cat))];
    $(".feed-filters").innerHTML = cats.map((c, i) => `<button class="chip" data-f="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join("");
    $(".posts").innerHTML = rest.map((p, i) => `<button class="post rv rv-d${i % 3}" data-id="${esc(p.id)}" data-cat="${esc(p.cat)}">
      <div class="art" style="background:${p.color}">${art(p)}</div>
      <div class="txt">${meta(p)}<h3>${esc(p.title)}</h3><p>${esc(p.ex)}</p></div></button>`).join("");
    $(".feed-filters").addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      $$(".feed-filters .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
      $$(".post").forEach((p) => p.classList.toggle("hide", c.dataset.f !== "All" && p.dataset.cat !== c.dataset.f));
    });

    // reader
    const reader = $(".reader");
    let opener = null;
    const open = (id) => {
      const p = D.posts.find((x) => x.id === id);
      if (!p) return;
      const body = p.body || [["p", p.ex], ["p", "This article is still being written. Check back soon."]];
      $("article", reader).innerHTML = `${meta(p)}<h1>${esc(p.title)}</h1>` + body.map(([t, x]) =>
        t === "h" ? `<h2>${esc(x)}</h2>` : t === "q" ? `<blockquote>${esc(x)}</blockquote>` : `<p>${esc(x)}</p>`).join("") +
        `<div class="end"><h3 style="font-size:28px">Want this kind of thinking on your brand?</h3>
          <p>Get the next one in your inbox, or let's talk about your business.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-brand" href="start.html">Let's talk →</a><a class="btn btn-light" href="#newsletter" data-close>Join the newsletter</a></div></div>`;
      reader.classList.add("open"); reader.scrollTop = 0; document.body.style.overflow = "hidden";
      history.replaceState(null, "", "#" + p.id);
      $(".bar button", reader).focus();
    };
    const close = () => {
      if (!reader.classList.contains("open")) return;
      reader.classList.remove("open"); document.body.style.overflow = "";
      history.replaceState(null, "", location.pathname);
      if (opener) opener.focus();
    };
    overlays.push(close);
    $(".bar button", reader).addEventListener("click", close);
    reader.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".post, .featured"); if (!b) return;
      opener = b; open(b.dataset.id);
    });
    const h = D.posts.find((p) => "#" + p.id === location.hash);
    if (h) setTimeout(() => open(h.id), 300);

  };

  function newsletter() {
    const form = $(".nl-form"); if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("input", form).value.trim(), note = $(".nl-note");
      if (!/^\S+@\S+\.\S+$/.test(email)) { note.textContent = "That email doesn't look right. Try again?"; return; }
      const btn = $("button", form); btn.disabled = true;
      const saved = await save("subscribers", { email: email.toLowerCase(), source: location.pathname });
      btn.disabled = false;
      if (!saved) { note.textContent = "Sign-ups aren't open yet. Please try again soon."; return; }
      form.innerHTML = `<span style="padding:12px 16px;color:var(--ink);font-weight:600">You're on the list. The first issue is on its way.</span>`;
      note.textContent = "";
    });
  }

  /* ----- 05 ABOUT ----- */
  R.about = () => {
    // typed answer to "like what exactly?"
    const t = $(".typed");
    const words = ["our favourite food?", "our favourite colour?", "why we're called Clicksyde?", "who's on the team?"];
    let wi = 0, ci = 0, del = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const type = () => {
      const w = words[wi];
      t.textContent = w.slice(0, ci);
      if (!del && ci < w.length) ci++; else if (!del) { del = true; return setTimeout(type, 1600); }
      else if (ci > 0) ci--; else { del = false; wi = (wi + 1) % words.length; }
      setTimeout(type, del ? 30 : 60);
    };
    if (reduce) t.textContent = words[0]; else type();

    $(".facts").innerHTML = D.facts.map((f, i) => `<button class="fact rv rv-d${i % 3}" aria-pressed="false">
      <div class="inner"><div class="face front"><small>${esc(f.tag)}</small><span class="flip">Tap to flip ↻</span><div class="qq">${esc(f.q)}</div></div>
      <div class="face back"><small>${esc(f.q)}</small><div class="a">${esc(f.a)}</div></div></div></button>`).join("");
    $$(".fact").forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true")));

    $(".chapters-story").innerHTML = D.timeline.map((t) => `<div class="cs rv"><div class="yr">${esc(t.y)}</div><h3>${esc(t.h)}</h3><p>${esc(t.p)}</p></div>`).join("");
    $(".values").innerHTML = D.values.map((v) => `<div class="value rv">${v.i ? `<div class="ico" aria-hidden="true">${esc(v.i)}</div>` : ""}<div><h3>${esc(v.h)}</h3><p>${esc(v.p)}</p></div></div>`).join("");
    $(".team").innerHTML = D.team.map((m) => `<div class="member rv"><div style="overflow:hidden"><div class="ph${m.photo ? " has-photo" : ""}" style="background:${m.c}">${m.photo ? `<img data-media="${esc(m.photo)}" alt="${esc(m.n)}">` : esc(m.n.split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase())}</div></div>
      <div class="tx"><b>${esc(m.n)}</b><span>${esc(m.r)}</span><span class="odd">${esc(m.odd)}</span></div></div>`).join("");
  };

  /* ----- 06 LET'S TALK: 4 short questions as a chat ----- */
  R.talk = () => {
    const Q = D.questions;
    const params = new URLSearchParams(location.search);
    const pre = D.services.find((s) => s.id === params.get("service"));
    const ans = { need: [], budget: "", when: "", name: "", business: "", contact: "", about: "", service: pre ? pre.t : "" };
    $("[data-mark]").innerHTML = mark();
    $("[data-mail]").href = "mailto:" + D.contact.email;
    $("[data-mail-text]").textContent = D.contact.email;
    const body = $(".convo-body");
    const bars = $$(".qbar i");
    const steps = ["need", "who", "budget", "reach"];
    const setBar = (n) => bars.forEach((b, i) => b.classList.toggle("on", i < n));

    const say = (html, qn) => { body.insertAdjacentHTML("beforeend", `<div class="bubble us">${qn ? `<span class="qn">${qn}</span>` : ""}${html}</div>`); };
    const reply = (text, stepIdx) => {
      body.insertAdjacentHTML("beforeend", `<div class="bubble them">${esc(text)}<button data-edit="${stepIdx}">edit</button></div>`);
    };
    const scroll = () => { const last = body.lastElementChild; if (last && last.getBoundingClientRect().bottom > innerHeight - 110) last.scrollIntoView({ behavior: "smooth", block: "center" }); };

    const render = (from) => {
      body.innerHTML = "";
      say(`Welcome. Four short questions, about a minute.${pre ? ` We see you're interested in <b>${esc(pre.t)}</b>.` : ""}`);
      for (let i = 0; i < steps.length; i++) {
        if (i < from) { ask(i, true); continue; }
        ask(i, false); break;
      }
      setBar(from);
    };

    const ask = (i, answered) => {
      const s = steps[i];
      if (s === "need") {
        say("What do you need help with? Pick as many as you like.", "1 of 4");
        if (answered) return reply(ans.need.join(", "), i);
        const pane = answer(`<div class="opts">${Q.need.map((o) => `<button class="opt" aria-pressed="${ans.need.includes(o)}">${esc(o)}</button>`).join("")}</div>
          <div class="go-row"><span class="err"></span><button class="btn btn-dark" data-next>Next <span class="arr">→</span></button></div>`);
        $$(".opt", pane).forEach((b) => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"));
        $("[data-next]", pane).onclick = () => {
          ans.need = $$(".opt[aria-pressed=true]", pane).map((b) => b.textContent);
          if (!ans.need.length) return ($(".err", pane).textContent = "Pick at least one.");
          render(1);
        };
      }
      if (s === "who") {
        say("Nice. Who are we talking to? Tell us about you and your business, like you'd text a friend.", "2 of 4");
        if (answered) return reply(`${ans.name}, ${ans.business}${ans.about ? ` · “${ans.about}”` : ""}`, i);
        const pane = answer(`<div class="row2"><div class="field"><label for="f-name">Your name</label><input id="f-name" autocomplete="name" value="${esc(ans.name)}"></div>
          <div class="field"><label for="f-biz">Business or brand</label><input id="f-biz" autocomplete="organization" value="${esc(ans.business)}"></div></div>
          <div class="field"><label for="f-about">Anything we should know? <span class="muted">(optional, one line is fine)</span></label>
          <textarea id="f-about" rows="2" placeholder="e.g. We sell skincare online and want to open a store in Abuja">${esc(ans.about)}</textarea></div>
          <div class="go-row"><span class="err"></span><button class="btn btn-dark" data-next>Next <span class="arr">→</span></button></div>`);
        $("#f-name", pane).focus({ preventScroll: true });
        $("[data-next]", pane).onclick = () => {
          ans.name = $("#f-name", pane).value.trim(); ans.business = $("#f-biz", pane).value.trim(); ans.about = $("#f-about", pane).value.trim();
          if (!ans.name || !ans.business) return ($(".err", pane).textContent = "Just your name and business, please.");
          render(2);
        };
      }
      if (s === "budget") {
        say(`Thanks, ${esc(ans.name.split(" ")[0])}! Roughly what budget and timeline are you working with? No wrong answers, it just helps us plan.`, "3 of 4");
        if (answered) return reply(`${ans.budget} · ${ans.when}`, i);
        const pane = answer(`<p class="opts-label" id="l-budget">Budget</p>
          <div class="opts" data-g="budget" role="group" aria-labelledby="l-budget">${Q.budget.map((o) => `<button class="opt" aria-pressed="${ans.budget === o}">${esc(o)}</button>`).join("")}</div>
          <p class="opts-label" id="l-when">Timeline <span class="muted">(when do you need this?)</span></p>
          <div class="opts" data-g="when" role="group" aria-labelledby="l-when">${Q.when.map((o) => `<button class="opt" aria-pressed="${ans.when === o}">${esc(o)}</button>`).join("")}</div>
          <div class="go-row"><span class="err"></span><button class="btn btn-dark" data-next>Next <span class="arr">→</span></button></div>`);
        $$(".opts", pane).forEach((g) => g.addEventListener("click", (e) => {
          const b = e.target.closest(".opt"); if (!b) return;
          $$(".opt", g).forEach((x) => x.setAttribute("aria-pressed", x === b));
          ans[g.dataset.g] = b.textContent;
        }));
        $("[data-next]", pane).onclick = () => {
          if (!ans.budget || !ans.when) return ($(".err", pane).textContent = "Pick one of each.");
          render(3);
        };
      }
      if (s === "reach") {
        say("Last one. Where can we reach you? We reply within one working day.", "4 of 4");
        const pane = answer(`<div class="field"><label for="f-contact">Email or WhatsApp number</label><input id="f-contact" autocomplete="email" value="${esc(ans.contact)}" placeholder="you@brand.com or 0801 234 5678"></div>
          <div class="go-row"><span class="err"></span><button class="btn btn-brand" data-next>Send it <span class="arr">→</span></button></div>`);
        $("[data-next]", pane).onclick = async () => {
          ans.contact = $("#f-contact", pane).value.trim();
          const okEmail = /^\S+@\S+\.\S+$/.test(ans.contact), okPhone = ans.contact.replace(/\D/g, "").length >= 10;
          if (!okEmail && !okPhone) return ($(".err", pane).textContent = "That doesn't look like an email or phone number.");
          const btn = $("[data-next]", pane); btn.disabled = true; btn.firstChild.textContent = "Sending… ";
          const saved = await save("leads", {
            name: ans.name, business: ans.business, needs: ans.need, service: ans.service || null,
            budget: ans.budget, timeline: ans.when, contact: ans.contact, about: ans.about || null, page: location.pathname
          });
          pane.remove(); reply(ans.contact, 3); setBar(4);
          done(saved);
        };
      }
      scroll();
    };

    const answer = (html) => { body.insertAdjacentHTML("beforeend", `<div class="answer">${html}</div>`); return body.lastElementChild; };

    const done = (saved) => {
      const summary = `Hi Clicksyde! I'm ${ans.name} from ${ans.business}.\nI need: ${ans.need.join(", ")}${ans.service ? ` (${ans.service})` : ""}\nBudget: ${ans.budget}\nTimeline: ${ans.when}\nReach me: ${ans.contact}${ans.about ? `\nAbout us: ${ans.about}` : ""}`;
      const wa = D.contact.whatsapp ? `https://wa.me/${D.contact.whatsapp}?text=${encodeURIComponent(summary)}` : "";
      const mail = `mailto:${D.contact.email}?subject=${encodeURIComponent("New project: " + ans.business)}&body=${encodeURIComponent(summary)}`;
      body.insertAdjacentHTML("beforeend", `<div class="done-card">
        <h3>${saved ? `Thank you, ${esc(ans.name.split(" ")[0])}.` : `Almost there, ${esc(ans.name.split(" ")[0])}`}</h3>
        ${saved ? "" : `<p>We couldn't send this from the page. Tap below to send it by email${wa ? " or WhatsApp" : ""}, or write to <b>${esc(D.contact.email)}</b>.</p>`}
        <p>Here's what happens next:</p>
        <ol><li>A strategist reads this today and replies within one working day.</li>
          <li>If it looks like a fit, they'll invite you to a 30-minute discovery call.</li>
          <li>A proposal with a plan, timeline and price, within 5 working days.</li></ol>
        <div class="acts">${saved ? "" : `<a class="btn btn-brand" href="${mail}">Send it by email</a>`}
          ${wa && !saved ? `<a class="btn btn-light" href="${wa}" target="_blank" rel="noopener">Send on WhatsApp</a>` : ""}
          <a class="btn btn-light" href="work.html">See our work while you wait</a></div>
      </div>`);
      scroll();
    };

    body.addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b && !$(".done-card", body)) render(Number(b.dataset.edit)); });
    render(0);
  };

  /* Saves a row to the Clicksyde Supabase project (tables in supabase/migrations).
     Returns true when saved. Returns false when Supabase isn't set up yet or the save failed,
     so the page can offer email/WhatsApp instead. */
  async function save(table, row) {
    if (D.demo && window.CSdemo) return window.CSdemo.save(table, row);
    const sb = D.supabase || {};
    if (!sb.url || !sb.key) return false;
    const headers = { "Content-Type": "application/json", apikey: sb.key, Prefer: "return=minimal" };
    if (sb.key.startsWith("eyJ")) headers.Authorization = "Bearer " + sb.key; // legacy anon key
    try {
      const r = await fetch(`${sb.url.replace(/\/$/, "")}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(row) });
      return r.ok || r.status === 409; // 409 = already subscribed
    } catch (_) { return false; }
  }
  /* Luxe finish: headlines rise in word by word, images unveil, a short branded intro on the first visit */
  function luxeFinish() {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const editing = new URLSearchParams(location.search).has("edit");
    if (still || editing) return;
    // headlines: wrap each word in a mask so it can rise into view (keeps inline styling such as the serif italics)
    $$("h1.rv, h2.rv, .h-lg.rv, .h-xl.rv, .turn .t, .sh-card h1").forEach((h) => {
      if (h.closest(".oneliner") || h.dataset.lx) return;
      h.dataset.lx = "1";
      let i = 0;
      const walk = (node) => Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 1) return walk(n);
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) return frag.appendChild(document.createTextNode(w));
          const o = document.createElement("span"); o.className = "lx-w";
          const inner = document.createElement("span"); inner.style.setProperty("--i", i++); inner.textContent = w;
          o.appendChild(inner); frag.appendChild(o);
        });
        n.replaceWith(frag);
      });
      walk(h);
      if (!h.classList.contains("rv")) h.classList.add("lx-self");
    });
    // images and media unveil as they scroll in
    const unveil = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lx-in"); unveil.unobserve(e.target); } }), { threshold: 0.15 });
    $$(".spot-media, .case .carousel, .member .ph, .post .art, .featured .art").forEach((el) => { el.classList.add("lx-img"); unveil.observe(el); });
    $$(".lx-self").forEach((el) => unveil.observe(el));
    $$(".sh-card h1").forEach((el) => el.classList.add("lx-in"));
    // a short branded intro, once per visit
    let seen = null; try { seen = sessionStorage.getItem("cs-intro"); sessionStorage.setItem("cs-intro", "1"); } catch (_) {}
    if (!seen) {
      const intro = document.createElement("div");
      intro.className = "lx-intro"; intro.setAttribute("aria-hidden", "true");
      intro.innerHTML = `<div class="lx-mark">${mark()}</div>`;
      document.body.appendChild(intro);
      requestAnimationFrame(() => intro.classList.add("go"));
      setTimeout(() => intro.classList.add("out"), 850);
      setTimeout(() => intro.remove(), 1700);
    }
  }

  function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  /* Home layout chosen in the admin panel: section order and hidden sections (the hero stays first) */
  if (page === "home" && D.layout) {
    let after = $("#after-hero") || $(".hero");
    D.layout.home.forEach((id) => {
      const el = $(`[data-block="${id}"]`); if (!el || !after) return;
      after.after(el); after = el;
      if ((D.layout.hidden || []).includes(id)) el.hidden = true;
    });
  }

  /* Demo preview: say so, and offer a way out */
  if (D.demo) {
    const b = document.createElement("div");
    b.className = "demo-banner";
    b.innerHTML = `<b>Demo preview</b><span>Changes saved in this browser only.</span><a href="admin.html">Admin</a><a href="${location.pathname}?demo=0">Exit</a>`;
    document.body.appendChild(b);
  }

  if (R[page]) R[page]();
  if (luxe) luxeFinish();
  $$("[data-media]").forEach((el) => window.CSmedia.resolve(el.dataset.media).then((u) => { if (u) el.src = u; else el.remove(); }));
  if (new URLSearchParams(location.search).has("edit")) {
    const ed = document.createElement("script"); ed.src = "js/editor.js?v=1"; document.body.appendChild(ed);
  }
  newsletter();
  observe();
  $$("[data-count]").forEach((el) => countIO.observe(el));
});
