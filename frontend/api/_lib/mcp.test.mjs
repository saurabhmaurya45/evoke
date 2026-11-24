import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { handleHttp, handleMessage, resetPriceCache, score, TOOLS } from './mcp.mjs';
import catalog from './mcp-catalog.mjs';

// A fake API: every catalog template listed, royal-gate paid at ₹999, the rest free,
// except tpl-temple-bells which is not on sale.
const apiBody = {
  data: catalog.templates.map((t, i) => ({
    slug: t.id,
    name: `Name ${t.id}`,
    displayOrder: i,
    storefrontStatus: t.id === 'tpl-temple-bells' ? 'UNLISTED' : 'LISTED',
    pricingModel: t.id === 'tpl-royal-gate' ? 'PAID' : 'FREE',
    priceAmountMinor: t.id === 'tpl-royal-gate' ? 99900 : null,
  })),
};
const okFetch = async () => new Response(JSON.stringify(apiBody), { status: 200 });
const downFetch = async () => {
  throw new Error('offline');
};

const call = (name, args = {}, fetchImpl = okFetch) =>
  handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, { fetchImpl });

beforeEach(() => resetPriceCache());

test('initialize agrees a protocol version and advertises tools', async () => {
  const r = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(r.result.protocolVersion, '2025-03-26');
  assert.ok(r.result.capabilities.tools);
  assert.equal(r.result.serverInfo.name, 'theinvitely');
  const unknown = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(unknown.result.protocolVersion, '2025-06-18');
});

test('notifications get no reply; unknown methods get -32601', async () => {
  assert.equal(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const r = await handleMessage({ jsonrpc: '2.0', id: 3, method: 'nope' });
  assert.equal(r.error.code, -32601);
});

test('tools/list returns every tool with a schema', async () => {
  const r = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.deepEqual(r.result.tools.map((t) => t.name), ['find_templates', 'get_template', 'start_invitation', 'pricing_and_faq']);
  for (const t of TOOLS) assert.equal(t.inputSchema.type, 'object');
});

test('find_templates matches the kind of wedding and leaves out unlisted designs', async () => {
  const r = await call('find_templates', { query: 'sikh anand karaj', limit: 13 });
  const ids = r.result.structuredContent.templates.map((t) => t.id);
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const t = catalog.templates.find((c) => c.id === id);
    assert.ok(t.communities.includes('sikh'), `${id} is not tagged sikh`);
  }
  const all = await call('find_templates', { limit: 13 });
  assert.ok(!all.result.structuredContent.templates.some((t) => t.id === 'tpl-temple-bells'));
});

test('find_templates respects a budget and links back with utm tags', async () => {
  const r = await call('find_templates', { max_price_inr: 0, limit: 13 });
  const found = r.result.structuredContent.templates;
  assert.ok(found.length > 0);
  assert.ok(found.every((t) => t.price_inr === 0));
  assert.ok(!found.some((t) => t.id === 'tpl-royal-gate'));
  assert.match(found[0].start_url, /^https:\/\/theinvitely\.in\/editor\/tpl-[a-z-]+\?utm_source=claude&utm_medium=mcp$/);
});

test('get_template accepts an id or a slug, and says when it is missing', async () => {
  const gate = catalog.templates.find((t) => t.id === 'tpl-royal-gate');
  const byId = await call('get_template', { template: 'tpl-royal-gate' });
  const bySlug = await call('get_template', { template: gate.slug });
  assert.equal(byId.result.structuredContent.id, 'tpl-royal-gate');
  assert.equal(bySlug.result.structuredContent.id, 'tpl-royal-gate');
  assert.match(byId.result.content[0].text, /₹999/);
  const missing = await call('get_template', { template: 'tpl-nope' });
  assert.equal(missing.result.isError, true);
});

test('start_invitation gives the editor link', async () => {
  const r = await call('start_invitation', { template: 'tpl-royal-gate' });
  assert.match(r.result.structuredContent.start_url, /^https:\/\/theinvitely\.in\/editor\/tpl-royal-gate\?/);
});

test('tools still answer when the API is down, without prices', async () => {
  const r = await call('find_templates', { limit: 13 }, downFetch);
  assert.equal(r.result.structuredContent.templates.length, catalog.templates.length);
  assert.ok(r.result.structuredContent.templates.every((t) => t.price_inr === null));
  const faq = await call('pricing_and_faq', {}, downFetch);
  assert.match(faq.result.content[0].text, /WhatsApp/);
});

test('unknown tool is a JSON-RPC error', async () => {
  const r = await call('delete_everything');
  assert.equal(r.error.code, -32602);
});

test('score prefers templates tagged for the community asked about', () => {
  const nikah = catalog.templates.find((t) => t.communities.includes('muslim-nikah'));
  const other = catalog.templates.find((t) => !t.communities.includes('muslim-nikah'));
  assert.ok(score({ ...nikah, name: nikah.style }, 'nikah invite') > score({ ...other, name: other.style }, 'nikah invite'));
});

test('HTTP: POST answers JSON, notifications get 202, GET is 405, bad JSON is 400', async () => {
  const post = (body) => new Request('https://theinvitely.in/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const ok = await handleHttp(post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Content-Type'), 'application/json');
  assert.deepEqual((await ok.json()).result, {});
  const note = await handleHttp(post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })));
  assert.equal(note.status, 202);
  assert.equal((await handleHttp(new Request('https://theinvitely.in/mcp'))).status, 405);
  assert.equal((await handleHttp(post('{not json'))).status, 400);
  const opts = await handleHttp(new Request('https://theinvitely.in/mcp', { method: 'OPTIONS' }));
  assert.equal(opts.status, 204);
  assert.equal(opts.headers.get('Access-Control-Allow-Origin'), '*');
});
