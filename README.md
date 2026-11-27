# Clicksyde website (layout build)

A plain static site with no build step. Open `index.html` through any local server (for example `npx serve .`).

## The idea: a digital storybook

Each page is a **chapter** that answers one question a prospective client has. Every page ends with a big **"Up next"** card that leads to the next one, so a visitor is always one tap from the next step. They can also jump around with the bottom dock or the full-screen menu (☰). Chapter numbers and funnel stages are for planning only and are not shown on the site.

| # | Page | File | Stage | Visitor's question |
|---|------|------|-------|--------------------|
| 01 | Hello (Home) | `index.html` | Understand | What does Clicksyde do, and is it for me? |
| 02 | The Wall (Services) | `services.html` | Explore | Which service solves my problem? |
| 03 | Receipts (Our Work) | `work.html` | Trust | Can Clicksyde deliver? |
| 04 | Insights (Blog) | `insights.html` | Grow | What do you know that I don't? |
| 05 | Still curious? (About) | `about.html` | Connect | Who's behind this? |
| 06 | Let's talk | `start.html` | Convert | How do we start? |

"Let's talk" (the conversion layer) can be reached from every page: the header button, the orange dock button, every "Up next" card, the end of every case study, every opened sticky note and every article.

**Retain & grow** is covered on the home page ("What happens after you say hi": Discover → Onboard → Deliver → Grow) and on the confirmation card after the form.

## What's on each page

- **Home**: a giant CLICKSYDE wordmark that splits open as you scroll and reveals the campaign reel card ("We make brands impossible to overlook"; "Skip the split" jumps past it, and with reduced motion it simply stacks), then the client logo strip, the message in one sentence, *Be seen / Be chosen / Be remembered*, an "Is this for me?" checklist, headline numbers and the client journey.
- **Services**: the services as sticky notes on a soft board. Tap a note and it opens into a full explanation (what you get, who it's for; "I need this" goes to the form with that service filled in). Problem chips and a problem finder light up the notes that fix a given problem. Notes can be linked directly, e.g. `services.html#ads`.
- **Work**: case studies (image carousel, "Clicksyde with Client" byline, results, expandable story), each followed by the client's testimonial and Clicksyde's reply.
- **Insights**: featured article, category filters, article cards that open in a full-screen reader, and the newsletter sign-up (*The Syde Note*).
- **Still curious?**: opens with the "you're still curious? Like what exactly?" line, flip cards (favourite food, colour…), the origin story, values and the team.
- **Let's talk**: 4 short questions asked as a chat (what you need → who you are + an optional one-liner → budget & timeline → how to reach you), editable answers, then a "what happens next" card.

## Look and feel

The original storybook (reel-wall hero, sticky-note wall, bottom dock), made subtly richer and kept distinct from the Bvndle / BRF sites: Manrope with Fraunces italics for emphasis, warm near-black and soft white with Clicksyde orange, soft-cornered buttons with a little depth, layered soft shadows, a dark-glass dock and a straight, calmer reel wall. The finish lives in the "SUBTLY RICH FINISH" block of `css/clicksyde.css`.

## Deploying (Netlify)

1. In Netlify: **Add new site → Import an existing project → GitHub → Aadeeyo/clicksyde**. `netlify.toml` sets everything: build command `node build.mjs`, publish folder `dist`. Then add the `clicksyde.com` domain under **Domain management**.
2. `build.mjs` reads what the admin saved in Supabase (falling back to `js/data.js`), copies the site and writes a page for every article (`/insights/<slug>`), case study (`/work/<slug>`) and service (`/services/<id>`), plus `sitemap.xml`. Try it locally with `node build.mjs`, then `npx serve dist`.
3. **Rebuild when the admin saves** (so the article, case study and service pages and the sitemap stay current):
   - Netlify: **Site configuration → Build & deploy → Build hooks → Add build hook** ("Admin saves"), copy its URL.
   - Supabase: **Database → Webhooks → Create a new hook** on table `site_content` (insert, update), type HTTP Request, method POST, URL = the build hook. Add a second hook on `posts` (insert, update, delete).
   Everything else on the site picks up admin changes instantly; the generated pages follow about a minute later.
4. `netlify.toml` also redirects the current clicksyde.com pages (`/about/`, `/services/`, `/projects/`, `/contact/`) to their new homes, so their search rankings carry over, and sets security headers.

## SEO

In place: keyword-led titles and descriptions per page (editable in admin > SEO), canonical URLs, Open Graph / X share tags with `assets/share.jpg` (1200x630), Organization + ProfessionalService + WebSite structured data on the home page, `robots.txt`, `sitemap.xml`, a branded `404.html`, alt text on content images, and `noindex` on demo, edit and preview links. URLs assume the site runs at `https://clicksyde.com/` with `.html` addresses: if the host serves clean URLs (`/services`), update the canonical tags and `sitemap.xml` to match, and update `<lastmod>` when pages change.

**Google Search Console.** `google594a04185ccaba3f.html` in the site root is Google's ownership file. Keep it there, unchanged, after launch; deleting it un-verifies the site.

Each article, case study and service can also have its own search title and description (the **Search (SEO)** panel in its editor). The generated pages use them; empty fields fall back to the title and summary.

**Analytics and cookies.** The site uses the Google Tag Manager container `GTM-NHWQTH5M` (set in `js/data.js`; admin > SEO > Analytics can replace it with another container or a GA4 measurement ID `G-…`, or clear it to switch analytics off). With Tag Manager, the events below arrive in the dataLayer as Custom Events, so GA4 needs to be set up inside Tag Manager: a Google tag with the GA4 measurement ID on All Pages, plus a GA4 Event tag per event, each fired by a Custom Event trigger with the same name. Until a visitor accepts the cookie notice, nothing from Google loads; "Decline" is remembered, and "Cookie settings" in the footer changes the choice. Analytics never runs in demo, edit or preview mode. Events sent: `generate_lead` (Let's talk form completed), `sign_up` (newsletter), `contact_click` (email, WhatsApp or phone link, with the method) and `cta_click` (any Let's talk button). In GA4, mark `generate_lead` and `sign_up` as key events (Admin → Events). `privacy.html` explains what is collected under the Nigeria Data Protection Act 2023; **have it reviewed by a lawyer before launch** and update the retention periods if they differ.

**Speed.** Only the font weights the site uses are loaded, and the condensed hero font (Archivo) only on the home page. Lighthouse (mobile, local): Performance 90, Accessibility 94, Best practices 96, SEO 92–100; Netlify's compression and caching should lift performance further. Re-check with PageSpeed Insights after launch.

**Luxe finish.** Admin > Layout & brand > Finish switches between Standard and Luxe (add `?luxe=1` or `?luxe=0` to any page to preview either without saving). Luxe keeps the design and adds: calmer spacing, word-by-word headline reveals, images that unveil on scroll, a fine film grain, an espresso and sand palette with orange as the accent, serif numerals, refined buttons, and a short branded intro once per visit. Reduced-motion visitors and edit mode get the colours without the motion. Styles live in the "LUXE FINISH" block of `css/clicksyde.css`; motion in `luxeFinish()` in `js/app.js`.

## Editing content

All copy starts in `js/data.js`: services, case studies, comments, articles, fun facts, team, form questions and contact details. Search for **PLACEHOLDER** to find everything that still needs real content.

## Admin panel (`admin.html`)

The team manages day-to-day content at `/admin.html` (not linked from the site, and hidden from search engines):

| Section | What it does |
|---|---|
| Overview | New leads, leads this month, subscribers, published articles, latest leads |
| Leads | Every "Let's talk" submission; filter by status, open one to email/WhatsApp/call them, set the status (new → contacted → call booked → proposal sent → won / lost), add team notes, export CSV |
| Newsletter | The Syde Note sign-ups; unsubscribe / resubscribe, export the active list as CSV |
| Blog | Write, edit, publish, unpublish, feature and delete Insights articles, with a cover colour, cover text or uploaded cover image |
| Services | Add, edit, reorder and delete the sticky notes on the Services wall (name, one-liner, description, what you get, great for, note colour) and choose which problems in the problem finder each one fixes. The Problem finder panel on the same screen edits the problems, their filter labels and which services each lights up |
| Case studies | Add, edit, reorder, publish/unpublish and delete the case studies on the Work page: client, headline, summary, tags and filter, slides (caption, big text, colour, image or video), results, the full story, the client testimonial and Clicksyde's reply |
| Page copy | Edit the headlines, intros, buttons and section text of every page directly on the page: open a page from the admin, click any outlined text, type, save. "Original wording" restores a text; "Back to original" resets a whole page |
| Contact form | Wording of the "Let's talk" chat (welcome line, the four questions, field labels and examples, Send button) and its answer options (needs, budgets, timelines). The four steps stay fixed so every lead fits the leads table |
| SEO | Search title and description for each page, with a Google-style preview and character counts, plus the Google Analytics 4 ID. Articles, case studies and services each have their own Search (SEO) panel in their editor |
| Media & spotlight | Upload or replace the hero reel video; edit the campaign frames behind the hero (caption, colour, optional still); switch on a Spotlight section on the home page featuring one campaign (image or video, title, text, button) |
| About page | Add, edit, reorder and remove the fun-fact flip cards (question, answer, label), the "Our story" timeline (year, heading, text) and the values (icon, heading, text) |
| Team | Add, edit, reorder and remove people on the About page (name, role, one odd fact, colour, photo), e.g. when someone changes position |
| Client logos | Add (one at a time or several at once), rename, reorder and remove brands in the "Trusted by" strip; set the overall logo size (Small to Extra large) and zoom any single logo whose file has a lot of empty space around it |
| Contact & social | Lead inbox, WhatsApp number and the Instagram / LinkedIn / X / TikTok links |
| Layout & brand | Show, hide and reorder the home page sections (the hero stays first) and change the brand colour |

What the admin saves is loaded by `js/content.js` on top of `js/data.js`. If the database can't be reached, the site quietly uses `js/data.js`.

**Demo mode.** On the sign-in screen, *Explore the demo* opens the full admin with no account. Changes are saved in that browser only, and *View site* opens the site with `?demo=1` so you can see them (a yellow banner says it's a preview; *Exit* or `?demo=0` goes back). The "Let's talk" form and newsletter on the demo site feed the demo Leads and Newsletter screens. *Reset demo* starts over. Use this for walkthroughs; nobody else sees the changes.

**Live mode** (real changes for every visitor):

1. In the Clicksyde Supabase project, run `supabase/migrations/20261126000000_clicksyde_admin.sql` in the SQL Editor (after the leads migration below). It adds the `site_content` and `posts` tables and a public `media` bucket for uploaded images. Visitors can only read published content; only admins can change anything.
2. Create each team member under **Authentication → Users** (with a password, or let them use the emailed sign-in link), then add their user id to the `admins` table.
3. Under **Authentication → URL Configuration**, add the site's `/admin.html` address to the redirect URLs so emailed sign-in links work.
4. Sign in at `/admin.html`. The first time you open **Blog**, import the starter articles (or start empty) so the blog is managed from the admin from then on.

**Page copy for developers.** Every fixed text on a page carries `data-copy="<page>.<n>"` (e.g. `home.4`). Edits are saved by that id in `site_content.data.copy` and applied by `js/app.js` before the page renders; `js/editor.js` is the on-page editor (loaded with `?edit=1`). Never renumber existing ids, or saved edits land on the wrong text. Give new text the next unused number on that page. Edited copy is cleaned to plain text plus bold/italic, line breaks, links and the `serif`/`accent` highlight spans.

**Video uploads (live).** Run `supabase/migrations/20261127000000_clicksyde_media.sql` once so the media bucket accepts MP4/WebM up to 50 MB (the Supabase free plan's upload limit). In demo mode, uploaded media is kept in the browser (IndexedDB).

Not in the admin yet (still edited in `js/data.js`): the typed prompts after "Like what exactly?" on the About page.

## To add before launch

1. **Hero video**: put the campaign mashup at `assets/reel.mp4` (muted, about 15–30s, under 8MB). It replaces the frame wall automatically.
2. **Client logos**: the official logo files from clicksyde.com are in `assets/clients/` and listed in `clients` in `js/data.js` (or managed in the admin).
3. **Contact settings** in `js/data.js → contact`: the real inbox and WhatsApp number (social links are set to the @clicksyde accounts).
4. **Where leads go**: form answers and newsletter sign-ups are saved to the Clicksyde Supabase project (`https://jcwekuxjhcceqprefudc.supabase.co`). To switch it on:
   1. In Supabase, open **SQL Editor**, paste in `supabase/migrations/20261125000000_clicksyde_leads.sql` and run it. This creates the `leads` and `subscribers` tables. Visitors can only add rows; only admins can read them.
   2. Copy the **publishable key** (Project Settings → API Keys, starts with `sb_publishable_`) into `supabase.key` in `js/data.js`. Never use the secret or service_role key.
   3. Leads then appear in **Table Editor → leads**. To let a teammate read them from an admin page later, add their user id to the `admins` table.

   Until the key is set, the form still works: the confirmation card asks the visitor to send their answers by email or WhatsApp, and the newsletter says sign-ups aren't open yet.
5. **Real case studies and client-approved testimonials** (cases 2 and 3 are placeholders), photos for the carousels, team photos and the real origin story.
6. **Logo**: the official Clicksyde logo from clicksyde.com is in `js/logo.js` (used across the site and admin), with files in `assets/logo.svg`, `assets/logo-white.svg` and `assets/favicon.svg`.
