# Keyword analysis — theinvitely.in

The source for `src/app/core/constants/seo.constants.ts`. Last reviewed: 2026-10-03.

## How this was done

- Started from the existing keyword file.
- Checked Google results for the main terms and mapped each keyword to what the product actually does: invitation **websites** with photos, music, venue maps and RSVP.
- **No search-volume tool was used.** The priorities below are judgement calls. Check them in Google Keyword Planner (location: India), then re-rank from Search Console query data 4–6 weeks after launch.

## Competitors

| Site | What ranks | Notes |
|---|---|---|
| DesiEvite | Category pages per occasion, per community, and "for WhatsApp" tag pages | Dominates the "card" and "e-card" terms; cards from ₹70 |
| Wedsmint | Wedding invitation website with RSVP, QR code and maps | Closest direct rival (₹1,999) |
| WedMeGood | `/wedding-invitations` | Very strong domain |
| Inytes, DigiInvite, Wedmake, Selfanimate, Pikaaso, InviteMart | E-cards and video invitations | |

**What this means for us:** a new domain can't win "wedding invitation card" yet. We go after:
- **"Invitation website" terms**, which describe our product exactly and where fewer competitors focus.
- **Community and ceremony long-tail terms**, where competition is weaker.
- **Template pages**, for design-led searches.
- **Wording and message searches** for the blog. These have high volume and low commercial intent, and they build the site's authority.

## Keyword clusters

| Cluster | Primary keywords | Intent | Priority | Target page |
|---|---|---|---|---|
| A. Core product | wedding invitation website, online wedding invitation, digital wedding invitation India, wedding website India, e invite for wedding | Commercial | P1 | `/` |
| B. WhatsApp sharing | whatsapp wedding invitation, wedding invitation link for whatsapp, digital invitation card for whatsapp | Commercial | P1 | `/`, `/wedding-invitations` |
| C. Feature-led | wedding invitation with RSVP, invitation with google map location, wedding invitation with music and photos, wedding countdown website | Commercial | P1 | `/wedding-invitations` |
| D. Templates | wedding invitation templates online, royal wedding invitation design, traditional wedding invitation template | Commercial | P1 | `/templates`, `/templates/:slug` |
| E. Community | punjabi / sikh (anand karaj) / nikah / hindu / south indian (tamil, temple) / christian wedding invitation | Commercial, long-tail | P2 | `/wedding-invitations/:community` |
| F. Ceremonies | haldi, mehndi, sangeet, reception invitation; save the date; engagement / ring ceremony / sagai | Commercial, long-tail | P2 | `/engagement-invitations`, hub sections |
| G. Hinglish / vernacular | shaadi invitation card online, shaadi ka card, lagna patrika, kankotri | Commercial | P2 | Copy and FAQs on cluster pages |
| H. Informational | wedding invitation wording (Hindi / English), haldi invitation message, how to send wedding invitation on WhatsApp | Informational | P3 | `/blog/*` |
| I. Brand | theinvitely, the invitely, theinvitely.in | Navigational | P1 | Home, Organization schema |

## Where each page is defined

| Route | Defined in |
|---|---|
| `/` | `home-page.component.ts`, `APP_DESCRIPTION` |
| `/templates` | `template-gallery.component.ts` |
| `/templates/:slug` | `features/templates/data/template-seo.data.ts` |
| `/wedding-invitations`, `/engagement-invitations`, `/wedding-invitations/:community` | `features/landing/data/landing-pages.data.ts` |
| `/blog/:slug` | `features/blog/data/blog-posts.data.ts` |

**Rules for new pages:**
- Add the entry to the matching data file. The route, prerendering, metadata and sitemap all follow from it.
- Never change a published slug without adding a 301 redirect in `netlify.toml`.
- Keep titles at 60 characters or fewer and meta descriptions at 155 or fewer.
