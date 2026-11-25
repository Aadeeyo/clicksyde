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

- **Home**: split hero over a campaign reel, a logo slideshow, the message in one sentence (it lights up as you scroll), *Be seen / Be chosen / Be remembered*, an "Is this for me?" checklist, headline numbers and the client journey.
- **The Wall**: nine services as sticky notes on a pink wall. Tap a note and it opens into a full explanation (what you get, who it's for, "I need this" goes to the form with that service filled in). Problem chips and a problem finder light up the notes that fix a given problem. Notes can be linked directly, e.g. `services.html#ads`.
- **Receipts**: a feed of case studies (image carousel, "clicksyde ✓ with Client" byline, stat tiles, expandable story). The client's feedback sits right under each case study as a social-media-style comment thread, with a pinned comment, a Clicksyde reply and like buttons.
- **Insights**: featured article, category filters, article cards that open in a full-screen reader, and the newsletter sign-up (*The Syde Note*).
- **Still curious?**: opens with the "you're still curious? Like what exactly?" line, flip cards (favourite food, colour…), the origin story, values and the team.
- **Let's talk**: 4 short questions asked as a chat (what you need → who you are + an optional one-liner → budget & timeline → how to reach you), editable answers, then a "what happens next" card.

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
| Services | Add, edit, reorder and delete the sticky notes on The Wall (name, one-liner, description, what you get, great for, note colour) and choose which problems in the problem finder each one fixes |
| Client logos | Add, rename, reorder and remove brands in the home page slideshow, and upload their logos |
| Contact & social | Lead inbox, WhatsApp number and the Instagram / LinkedIn / X / TikTok links |
| Layout & brand | Show, hide and reorder the home page sections (the hero stays first) and change the brand colour |

What the admin saves is loaded by `js/content.js` on top of `js/data.js`. If the database can't be reached, the site quietly uses `js/data.js`.

**Demo mode.** On the sign-in screen, *Explore the demo* opens the full admin with no account. Changes are saved in that browser only, and *View site* opens the site with `?demo=1` so you can see them (a yellow banner says it's a preview; *Exit* or `?demo=0` goes back). The "Let's talk" form and newsletter on the demo site feed the demo Leads and Newsletter screens. *Reset demo* starts over. Use this for walkthroughs; nobody else sees the changes.

**Live mode** (real changes for every visitor):

1. In the Clicksyde Supabase project, run `supabase/migrations/20261126000000_clicksyde_admin.sql` in the SQL Editor (after the leads migration below). It adds the `site_content` and `posts` tables and a public `media` bucket for uploaded images. Visitors can only read published content; only admins can change anything.
2. Create each team member under **Authentication → Users** (with a password, or let them use the emailed sign-in link), then add their user id to the `admins` table.
3. Under **Authentication → URL Configuration**, add the site's `/admin.html` address to the redirect URLs so emailed sign-in links work.
4. Sign in at `/admin.html`. The first time you open **Blog**, import the starter articles (or start empty) so the blog is managed from the admin from then on.

Not in the admin yet (still edited in `js/data.js`): case studies and comments, team and fun facts, page headlines, the wording of the problem-finder problems.

## To add before launch

1. **Hero video**: put the campaign mashup at `assets/reel.mp4` (muted, about 15–30s, under 8MB). It replaces the animated frame wall automatically.
2. **Client logos**: logos live in `assets/clients/` and are listed in `clients` in `js/data.js`. Domino's, Airtel, Access Bank, KFC and Cold Stone came from Wikimedia Commons / Wikipedia; swap in the brands' official files if you have them. pieXpress and i-Fitness still show as text until their logo files are added.
3. **Contact settings** in `js/data.js → contact`: the real inbox and WhatsApp number (social links are set to the @clicksyde accounts).
4. **Where leads go**: form answers and newsletter sign-ups are saved to the Clicksyde Supabase project (`https://jcwekuxjhcceqprefudc.supabase.co`). To switch it on:
   1. In Supabase, open **SQL Editor**, paste in `supabase/migrations/20261125000000_clicksyde_leads.sql` and run it. This creates the `leads` and `subscribers` tables. Visitors can only add rows; only admins can read them.
   2. Copy the **publishable key** (Project Settings → API Keys, starts with `sb_publishable_`) into `supabase.key` in `js/data.js`. Never use the secret or service_role key.
   3. Leads then appear in **Table Editor → leads**. To let a teammate read them from an admin page later, add their user id to the `admins` table.

   Until the key is set, the form still works: the confirmation card asks the visitor to send their answers by email or WhatsApp, and the newsletter says sign-ups aren't open yet.
5. **Real case studies and client-approved testimonials** (cases 2 and 3 are placeholders), photos for the carousels, team photos and the real origin story.
6. **Logo**: the header uses an SVG approximation of the mark. Drop in the official SVG when available.
