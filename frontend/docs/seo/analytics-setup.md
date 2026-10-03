# Google Analytics & Search Console setup

The two tools answer different questions:

| Question | Tool |
|---|---|
| Which **keywords** do we rank for? What position, how many impressions and clicks? | **Google Search Console** |
| What do visitors do? Which pages lead to a template being chosen or a purchase? | **Google Analytics 4** |

Google hides search keywords from Analytics. Keyword rankings come from Search Console, and linking the two shows Search Console's queries inside GA4.

The code is already in place (`src/app/core/services/analytics.service.ts`). It does nothing until a Measurement ID is set.

## 1. Google Search Console (keyword rankings)

1. Go to <https://search.google.com/search-console>, choose **Add property**, then **Domain**, and enter `theinvitely.in`.
2. Google shows a **TXT record** (`google-site-verification=…`). Add it in your domain registrar's DNS settings:
   - **Type:** TXT
   - **Host/Name:** `@`
   - **Value:** the string Google gave you
3. Click **Verify**. DNS can take from a few minutes to a few hours.
4. Go to **Sitemaps**, then submit `https://theinvitely.in/sitemap.xml`.
5. Use **URL Inspection** on `/`, `/wedding-invitations` and one `/templates/…` page, then click **Request indexing**.

Data starts appearing after 2–3 days.

## 2. Google Analytics 4 (visitor behaviour and conversions)

1. Go to <https://analytics.google.com>, open **Admin**, and **Create property** named `theinvitely.in`. Set the time zone to India and the currency to INR.
2. Add a **Web data stream** for `https://theinvitely.in`.
3. In the stream, open **Enhanced measurement** and select ⚙, then **Page views**, then **Show advanced settings**, and **turn off "Page changes based on browser history events"**.
   This matters: the app sends its own `page_view` on every navigation, and leaving this on would count every page twice.
4. Copy the **Measurement ID** (`G-XXXXXXXXXX`) into `src/environments/environment.production.ts`:
   ```ts
   gaMeasurementId: 'G-XXXXXXXXXX',
   ```
   Then deploy. Dev and staging have an empty ID, so they never send data.
5. Go to **Admin**, then **Events**. Once the events below have arrived, mark `select_template` and `publish_invitation` as **key events**. `purchase` is a key event automatically.
6. Check it works: open the site, then go to **Reports** and then **Realtime**. Your visit should appear within a minute.

## 3. Link them (keywords inside GA4)

1. In GA4, go to **Admin**, then **Product links**, then **Search Console links**, and **Link**. Choose the `theinvitely.in` property and the web stream.
2. Go to **Reports**, then **Library**, open the **Search Console** collection and **Publish** it.
3. You now have **Search Console → Queries** (keywords) and **Google organic search traffic** (landing pages) inside GA4. The landing-page report sits next to your conversion events.

## What the site sends

| Event | When | Parameters |
|---|---|---|
| `page_view` | Every page, including in-app navigation | `page_path` and `page_location` (query string removed), `page_title` |
| `select_template` | "Use this template" or "Use Template" clicked | `template_id`, `template_name`, `source` (`home`, `gallery`, `template_page`) |
| `publish_invitation` | Invitation published | `method` (`free` or `paid`) |
| `purchase` | Razorpay payment confirmed | `transaction_id`, `value`, `currency` |

**Not tracked:** couples' invitation pages (`/i/…`). Guests who only open an invitation never load Google Analytics or get its cookies. Query strings are never sent, because they can carry auth and payment tokens. The privacy policy describes all of this.

## Weekly keyword check

1. In Search Console, go to **Performance**, then **Search results**. Turn on **Average position** and filter **Country = India**.
2. **Queries tab:** keywords and their position. Use a **Query** filter with **Custom (regex)** to track one cluster at a time:
   - Community: `punjabi|sikh|anand karaj|nikah|south indian|tamil|christian`
   - Product: `invitation website|wedding website|e.?invite|whatsapp`
   - Blog: `wording|message|how to`
3. **Pages tab:** shows which landing page earns which queries.
4. **Queries with impressions but position 8–20** are the quickest wins. Strengthen the page that ranks for them: add a section, an FAQ or internal links.
5. Re-rank the clusters in [keyword-analysis.md](keyword-analysis.md) every 4–6 weeks from this data.
