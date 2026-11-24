// theinvitely.in's MCP server: lets Claude (and other MCP clients) find a wedding invitation
// template that fits a couple and hand them a link to start it on theinvitely.in.
//
// Stateless Streamable HTTP (MCP spec 2025-06-18): every JSON-RPC message is a POST answered
// with application/json; there are no sessions and no server-initiated messages, so GET (an SSE
// stream) is not offered. All tools are read-only and need no sign-in.
//
// Template descriptions come from mcp-catalog.mjs (generated from the site's own copy, see
// scripts/generate-mcp-catalog.mjs); names, prices and which templates are on sale come live
// from the API.
import catalog from './mcp-catalog.mjs';

export const SITE = 'https://theinvitely.in';
export const API_TEMPLATES = 'https://evokebackend.vercel.app/v1/templates?page_size=100';
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const PRICE_CACHE_MS = 5 * 60 * 1000;
const API_TIMEOUT_MS = 2500;
const SERVER_INFO = { name: 'theinvitely', title: 'theinvitely.in — Wedding Invitation Websites', version: '1.0.0' };

const INSTRUCTIONS = `theinvitely.in makes wedding invitation websites for Indian weddings (Hindu, Sikh/Punjabi,
Muslim Nikah, South Indian, Christian and modern), sent to guests as one link on WhatsApp.
Use these tools when someone wants to make a wedding or engagement invitation, an e-invite, a wedding
website or a digital wedding card. Call find_templates to suggest designs that fit their wedding,
get_template for one design's details, start_invitation to give them the link that opens it in the
editor, and pricing_and_faq for prices and common questions. Always give the user the links so they
can see the designs themselves.`;

// ---- links ---------------------------------------------------------------------------------

/** A theinvitely.in link, tagged so visits from Claude show up in analytics. */
export function link(path) {
  const url = new URL(path, SITE);
  url.searchParams.set('utm_source', 'claude');
  url.searchParams.set('utm_medium', 'mcp');
  return url.toString();
}

const pageLink = (t) => link(`/templates/${t.slug}`);
const previewLink = (t) => link(`/preview/${t.id}`);
const startLink = (t) => link(`/editor/${t.id}`);

// ---- live prices ---------------------------------------------------------------------------

let priceCache = { at: 0, byId: null };

/** Name, price and on-sale status by template id, from the API (cached; null if unreachable). */
export async function livePrices(fetchImpl = fetch, now = Date.now()) {
  if (priceCache.byId && now - priceCache.at < PRICE_CACHE_MS) return priceCache.byId;
  try {
    const res = await fetchImpl(API_TEMPLATES, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const body = await res.json();
    const byId = new Map();
    for (const t of Array.isArray(body?.data) ? body.data : []) {
      if (typeof t?.slug !== 'string') continue;
      const paid = t.pricingModel === 'PAID' && Number(t.priceAmountMinor) > 0;
      byId.set(t.slug, {
        name: typeof t.name === 'string' ? t.name : null,
        listed: t.storefrontStatus === 'LISTED',
        order: Number.isFinite(t.displayOrder) ? t.displayOrder : 999,
        priceInr: paid ? Math.round(Number(t.priceAmountMinor) / 100) : 0,
      });
    }
    priceCache = { at: now, byId };
    return byId;
  } catch {
    return priceCache.byId; // last good answer, or null
  }
}

export function resetPriceCache() {
  priceCache = { at: 0, byId: null };
}

/** The templates on sale, joined with their live name and price, in the site's order. */
async function templates(fetchImpl, now) {
  const live = await livePrices(fetchImpl, now);
  return catalog.templates
    .map((t) => {
      const p = live?.get(t.id);
      return { ...t, name: p?.name ?? t.style, priceInr: p ? p.priceInr : null, listed: live ? Boolean(p?.listed) : true, order: p?.order ?? 999 };
    })
    .filter((t) => t.listed)
    .sort((a, b) => a.order - b.order);
}

const priceText = (t) => (t.priceInr === null ? 'see the site for the price' : t.priceInr === 0 ? 'Free' : `₹${t.priceInr.toLocaleString('en-IN')}`);

// ---- matching ------------------------------------------------------------------------------

// Words people use for a kind of wedding, mapped to the site's community tags.
const SYNONYMS = {
  sikh: ['sikh', 'anand karaj', 'gurdwara', 'gurudwara'],
  punjabi: ['punjabi', 'punjab'],
  hindu: ['hindu', 'shaadi', 'vivah', 'pheras', 'phere', 'ganesh', 'mandap'],
  'muslim-nikah': ['muslim', 'nikah', 'nikkah', 'walima', 'islamic'],
  'south-indian': ['south indian', 'tamil', 'telugu', 'kannada', 'malayali', 'kerala', 'temple'],
  christian: ['christian', 'church', 'catholic'],
};

function words(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** How well a template fits a free-text request (0 = not at all). */
export function score(t, query) {
  const q = words(query);
  if (!q) return 1;
  let s = 0;
  for (const [tag, terms] of Object.entries(SYNONYMS)) {
    if (terms.some((term) => q.includes(term)) && t.communities.includes(tag)) s += 5;
  }
  const hay = words([t.style, t.name, t.summary, t.highlights.join(' '), t.keywords.join(' ')].join(' '));
  for (const w of q.split(' ')) if (w.length > 2 && hay.includes(w)) s += 1;
  return s;
}

// ---- tools ---------------------------------------------------------------------------------

const TEMPLATE_ARG = {
  type: 'string',
  description: 'The template id (e.g. "tpl-royal-gate") or its page slug (e.g. "royal-gate-sikh-wedding"), as returned by find_templates.',
};

export const TOOLS = [
  {
    name: 'find_templates',
    title: 'Find wedding invitation templates',
    description:
      'Suggests theinvitely.in wedding and engagement invitation website designs that fit a couple: by kind of wedding ' +
      '(Hindu, Sikh, Punjabi, Muslim Nikah, South Indian, Christian, modern, royal…), style words, and budget. ' +
      'Returns each design with its price and links to see it, preview it live and start it.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What they want, in their words, e.g. "Punjabi wedding with a royal look" or "simple nikah invite".' },
        max_price_inr: { type: 'number', minimum: 0, description: 'Only designs at or below this price in rupees. 0 means free designs only.' },
        limit: { type: 'integer', minimum: 1, maximum: 13, description: 'How many to return (default 5).' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  {
    name: 'get_template',
    title: 'Get one template',
    description: 'Full details of one theinvitely.in invitation design: what guests see, in order, its price, and links to preview and start it.',
    inputSchema: { type: 'object', properties: { template: TEMPLATE_ARG }, required: ['template'], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  {
    name: 'start_invitation',
    title: 'Start an invitation',
    description: 'Gives the link that opens a design in the theinvitely.in editor, where the couple fill in their details, preview and publish. Share this link with the user.',
    inputSchema: { type: 'object', properties: { template: TEMPLATE_ARG }, required: ['template'], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
  {
    name: 'pricing_and_faq',
    title: 'Prices and common questions',
    description: 'What theinvitely.in designs cost, what is included, how publishing and sharing on WhatsApp work, and answers to common questions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  },
];

// The site's own answers (src/app/features/home/data/home-content.service.ts): keep them in step.
const FAQ = [
  ['What events can I make invitations for?', 'Weddings and engagements today; birthdays, baby showers and corporate events are coming soon.'],
  ['Do I need design experience?', 'None at all. Choose a template and customise it with the simple, guided editor.'],
  ['Can I send it on WhatsApp?', 'Yes. The invitation is a single link, so it can go on WhatsApp, Instagram, SMS or email. Guests open it in their phone browser, with no app or download.'],
  ['Can I update it after publishing?', 'Yes. Edit details, photos and content any time; changes go live instantly.'],
  ['What happens after I pay?', 'You get a shareable link to the live invitation website immediately, ready to send to guests.'],
  ['Can guests RSVP and find the venue?', 'Yes. RSVP is built into every template, and each event can have its venue address with a Google Maps link.'],
  ['Why a website instead of a PDF card?', 'It opens instantly, plays your music, shows your photos, gives one-tap directions to every venue and collects RSVPs, and you can update it any time.'],
];

function findTemplate(list, key) {
  const k = String(key ?? '').trim().toLowerCase();
  return list.find((t) => t.id === k || t.slug === k) ?? list.find((t) => t.id === `tpl-${k}`);
}

function summaryLine(t) {
  return `**${t.name}** (${t.style}) — ${priceText(t)}\n${t.summary}\nSee it: ${pageLink(t)}\nLive preview: ${previewLink(t)}\nStart it: ${startLink(t)}`;
}

function brief(t) {
  return { id: t.id, name: t.name, style: t.style, price_inr: t.priceInr, summary: t.summary, page_url: pageLink(t), preview_url: previewLink(t), start_url: startLink(t) };
}

class ToolInputError extends Error {}

async function callTool(name, args, ctx) {
  const list = await templates(ctx.fetchImpl, ctx.now);
  if (name === 'find_templates') {
    const limit = Math.min(13, Math.max(1, Number.isInteger(args.limit) ? args.limit : 5));
    const max = typeof args.max_price_inr === 'number' ? args.max_price_inr : null;
    let matches = list
      .filter((t) => max === null || (t.priceInr !== null && t.priceInr <= max))
      .map((t) => ({ t, s: score(t, args.query) }));
    // Nothing matched the words: still offer designs (within budget) rather than nothing.
    if (args.query && matches.some((m) => m.s > 0)) matches = matches.filter((m) => m.s > 0);
    const picked = matches.sort((a, b) => b.s - a.s || a.t.order - b.t.order).slice(0, limit).map((m) => m.t);
    if (!picked.length) {
      return { text: `No theinvitely.in design is within ₹${max}. All designs: ${link('/templates')}`, data: { templates: [] } };
    }
    const text = `theinvitely.in designs that fit${args.query ? ` "${args.query}"` : ''}:\n\n${picked.map(summaryLine).join('\n\n')}\n\nAll designs: ${link('/templates')}`;
    return { text, data: { templates: picked.map(brief) } };
  }
  if (name === 'get_template' || name === 'start_invitation') {
    if (!args.template) throw new ToolInputError('template is required: a template id or slug from find_templates.');
    const t = findTemplate(list, args.template);
    if (!t) throw new ToolInputError(`No template "${args.template}". Use find_templates to see the ids.`);
    if (name === 'start_invitation') {
      const text = `Start ${t.name} here: ${startLink(t)}\n\nIn the editor the couple fill in their names, families, events and venues, see a live preview, then publish (${priceText(t)}) and get one link to share on WhatsApp.`;
      return { text, data: { id: t.id, name: t.name, start_url: startLink(t), price_inr: t.priceInr } };
    }
    const text = `**${t.name}** — ${t.style} — ${priceText(t)}\n\n${t.description}\n\nWhat guests see:\n${t.highlights.map((h) => `- ${h}`).join('\n')}\n\nSee it: ${pageLink(t)}\nLive preview: ${previewLink(t)}\nStart it: ${startLink(t)}`;
    return { text, data: { ...brief(t), description: t.description, highlights: t.highlights } };
  }
  if (name === 'pricing_and_faq') {
    const free = list.filter((t) => t.priceInr === 0).map((t) => t.name);
    const paid = list.filter((t) => t.priceInr > 0).map((t) => `${t.name} ${priceText(t)}`);
    const text = [
      'Prices on theinvitely.in (one-time, per invitation):',
      free.length ? `Free: ${free.join(', ')}` : null,
      paid.length ? `Paid: ${paid.join(', ')}` : null,
      `See every design: ${link('/templates')}`,
      '',
      ...FAQ.map(([q, a]) => `**${q}** ${a}`),
    ].filter((l) => l !== null).join('\n');
    return { text, data: { free, paid: list.filter((t) => t.priceInr > 0).map(brief), faq: FAQ.map(([question, answer]) => ({ question, answer })) } };
  }
  return null;
}

// ---- JSON-RPC ------------------------------------------------------------------------------

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Answers one JSON-RPC message; null for a notification (nothing to send back). */
export async function handleMessage(msg, ctx = {}) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request');
  }
  const isNotification = !('id' in msg);
  if (isNotification) return null;
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments && typeof params.arguments === 'object' ? params.arguments : {};
      if (!TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const out = await callTool(name, args, { fetchImpl: ctx.fetchImpl ?? fetch, now: ctx.now ?? Date.now() });
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: out.text }], structuredContent: out.data } };
      } catch (e) {
        if (e instanceof ToolInputError) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: e.message }], isError: true } };
        return rpcError(id, -32603, 'Internal error');
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Protocol-Version',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** The HTTP side: one POST carries one JSON-RPC message or a batch. */
export async function handleHttp(request, ctx = {}) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method === 'GET') {
    // No server-to-client stream: a stateless server answers every request in its response.
    return new Response('This MCP server is stateless: send JSON-RPC messages with POST.', {
      status: 405,
      headers: { ...CORS, Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } });
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }
  if (Array.isArray(body)) {
    if (!body.length) return json(rpcError(null, -32600, 'Invalid Request'), 400);
    const replies = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter(Boolean);
    return replies.length ? json(replies) : new Response(null, { status: 202, headers: CORS });
  }
  const reply = await handleMessage(body, ctx);
  return reply ? json(reply) : new Response(null, { status: 202, headers: CORS });
}
