import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { customShareImage, knownTemplates, posterPath, sharePhotos, shareText } from './share-meta.mjs';
import { cardVersion, describeCard, isOwnUpload } from './invitation.mjs';
import { escapeHtml, withShareTags } from './page-tags.mjs';

const ROOT = new URL('../../public/invitation-templates/', import.meta.url);
const index = JSON.parse(fs.readFileSync(new URL('templates.index.json', ROOT), 'utf8'));

function templateDefaults(previewUrl) {
  const folder = previewUrl.split('/')[2];
  return JSON.parse(fs.readFileSync(new URL(`${folder}/defaults.json`, ROOT), 'utf8'));
}

test('every registered template is mapped', () => {
  assert.deepEqual(knownTemplates().sort(), index.map((entry) => entry.id).sort());
});

for (const entry of index) {
  test(`${entry.id}: the names and a poster come out of its own sample data`, () => {
    const text = shareText(entry.id, templateDefaults(entry.previewUrl));
    assert.ok(text.names.length > 2, `names: "${text.names}"`);
    assert.ok(text.title.startsWith(text.names));
    assert.ok(text.description.length > 2);
    assert.match(posterPath(entry.id), /card-poster\.jpg$/);
  });
}

const LACE = { couple: { brideName: 'Tanu', groomName: 'Varun' }, countdown: { date: '2027-12-14' }, venue: { name: 'Sultanpur palace' } };

test('the default preview reads like the invitation', () => {
  const text = shareText('tpl-lace-classic', LACE);
  assert.equal(text.title, "Tanu & Varun's Wedding Invitation");
  assert.equal(text.description, '14 December 2027 · Sultanpur palace');
});

test('what the user typed wins, field by field, and is cut to length', () => {
  const custom = shareText('tpl-lace-classic', { ...LACE, share: { title: 'Please join us', description: '' } });
  assert.equal(custom.title, 'Please join us');
  assert.equal(custom.description, '14 December 2027 · Sultanpur palace');
  const long = shareText('tpl-lace-classic', { ...LACE, share: { title: 'x'.repeat(200), description: 'y'.repeat(300) } });
  assert.equal(long.title.length, 70);
  assert.equal(long.description.length, 150);
});

test('markup saved in a field stays out of the text', () => {
  const text = shareText('tpl-maroon-gold-royal', { hero: { brideName: 'A', groomName: 'B' }, venue: { address: 'Taj Palace,<br>Colaba' } });
  assert.equal(text.description, 'Taj Palace');
});

test('an unknown template or empty data still gives usable text', () => {
  assert.equal(shareText('nope', {}).title, 'Wedding Invitation');
  assert.equal(shareText('tpl-lace-classic', {}).description, 'You are cordially invited.');
  assert.deepEqual(sharePhotos('nope', {}), []);
  assert.equal(customShareImage({}), '');
});

const HOST = 'https://pub-da9e4ff58a2b4062a77df0109c7d7c6f.r2.dev';
const EVENT = '84e42375-ee8e-45fc-8e91-d24aeb713887';
const UPLOAD = `${HOST}/public/u1/${EVENT}/image/a.jpg`;
const SAMPLE = `${HOST}/asset/invitation-templates/template%2012/static/images/sample.jpg`;

test("only this invitation's own uploads count", () => {
  assert.ok(isOwnUpload(UPLOAD, EVENT));
  assert.ok(!isOwnUpload(SAMPLE, EVENT), 'sample photo');
  assert.ok(!isOwnUpload(`${HOST}/public/u1/other-event/image/a.jpg`, EVENT), 'another invitation');
  assert.ok(!isOwnUpload(`https://evil.example/public/u1/${EVENT}/image/a.jpg`, EVENT), 'another host');
  assert.ok(!isOwnUpload(`http://169.254.169.254/${EVENT}/image/a`, EVENT), 'internal address');
  assert.ok(!isOwnUpload('data:image/png;base64,AAAA', EVENT), 'inline');
  assert.ok(!isOwnUpload('not a url', EVENT));
});

const invitation = (draftData) => ({ eventId: EVENT, templateSlotId: 'tpl-lace-classic', draftData });

test('the card prefers the chosen picture, then an uploaded photo, then the poster', () => {
  const gallery = { items: [{ image: SAMPLE }, { image: UPLOAD }] };
  const chosen = `${HOST}/public/u1/${EVENT}/image/chosen.jpg`;
  const withChoice = describeCard(invitation({ ...LACE, gallery, share: { image: chosen } }));
  assert.equal(withChoice.image, chosen);
  assert.equal(withChoice.custom, true);
  const photo = describeCard(invitation({ ...LACE, gallery }));
  assert.equal(photo.image, UPLOAD);
  assert.equal(photo.custom, false);
  const poster = describeCard(invitation({ ...LACE, gallery: { items: [{ image: SAMPLE }] }, share: { image: 'https://evil.example/x.jpg' } }));
  assert.match(poster.image, /template%2012\/card-poster\.jpg$/);
  assert.equal(poster.custom, false);
});

test('the card version follows its content but not a URL signature', () => {
  const a = describeCard(invitation({ ...LACE, gallery: { items: [{ image: `${UPLOAD}?sig=1` }] } }));
  const b = describeCard(invitation({ ...LACE, gallery: { items: [{ image: `${UPLOAD}?sig=2` }] } }));
  const c = describeCard(invitation({ ...LACE, couple: { brideName: 'Riya', groomName: 'Varun' } }));
  assert.equal(cardVersion(a), cardVersion(b));
  assert.notEqual(cardVersion(a), cardVersion(c));
});

const SHELL = `<head><title>General</title><meta name="description" content="general">
<meta property="og:title" content="general"><meta property="og:image" content="/og.jpg" /></head>`;

test("the shell gets the invitation's tags, once each", () => {
  const html = withShareTags(SHELL, { title: 'T', description: 'D', url: 'https://x/i/a', image: 'https://x/c.jpg' });
  assert.ok(html.includes('<title>T</title>'));
  assert.ok(html.includes('<meta property="og:title" content="T">'));
  assert.ok(html.includes('<meta property="og:image" content="https://x/c.jpg">'));
  assert.equal(html.match(/og:title/g).length, 1);
  assert.ok(!html.includes('general'));
});

test('text a user typed cannot break out of the tags', () => {
  const nasty = '"><script>alert(1)</script> $& $1';
  const html = withShareTags(SHELL, { title: nasty, description: nasty, url: 'https://x', image: 'https://y' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes(escapeHtml(nasty)));
});
