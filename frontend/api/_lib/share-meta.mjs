/**
 * What an invitation's link preview says. Used by the Vercel functions next door and by the editor's
 * preview of the card, so what the user sees there is what WhatsApp gets. No dependencies, no I/O.
 *
 * Every template saves its details in different places, so each one is mapped here. `photos` lists
 * where its pictures live in preference order; `[]` means every item of a list.
 */
const TEMPLATES = {
  'tpl-samarpan-royal': {
    folder: 1,
    bride: 'hero.brideName',
    groom: 'hero.groomName',
    date: 'hero.date',
    photos: ['hero.heroImage', 'gallery.items[].src', 'portraits.bridePhoto', 'portraits.groomPhoto'],
  },
  'tpl-eternal-bond': {
    folder: 2,
    bride: 'hero.brideName',
    groom: 'hero.groomName',
    date: 'hero.date',
    venue: 'venue.name',
    photos: ['gallery.walking', 'gallery.handsJoined', 'gallery.dancing', 'gallery.laughing', 'storyPhotos.engagement'],
  },
  'tpl-beloved-nikkah': {
    folder: 3,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'ceremony.date',
    venue: 'venue.address',
    photos: [],
  },
  'tpl-rosewood-punjabi': {
    folder: 4,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    photos: ['gallery.photo1', 'gallery.photo2', 'gallery.photo3', 'gallery.photo4'],
  },
  'tpl-maroon-gold-royal': {
    folder: 5,
    bride: 'hero.brideName',
    groom: 'hero.groomName',
    date: 'countdown.targetDate',
    venue: 'venue.address',
    photos: ['ceremony.photo', 'gallery.items[].image', 'profiles.bridePhoto', 'profiles.groomPhoto'],
  },
  'tpl-doorway-modern': {
    folder: 6,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'ceremony.date',
    photos: ['gallery.items[].image'],
  },
  'tpl-golden-promise': {
    folder: 7,
    names: 'footer.coupleName',
    date: 'saveTheDate.targetDate',
    venue: 'venue.name',
    photos: ['hero.image', 'events.items[].image'],
  },
  'tpl-royal-gate': {
    folder: 8,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'countdown.date',
    photos: ['story.photos[].image', 'hero.poster'],
  },
  'tpl-chateau-classic': {
    folder: 9,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'wedding.date',
    venue: 'venue.name',
    photos: ['couple.image'],
  },
  'tpl-temple-bells': {
    folder: 10,
    bride: 'couple.brideShort',
    groom: 'couple.groomShort',
    date: 'wedding.date',
    venue: 'wedding.venue',
    photos: ['gallery.photos[].image', 'couple.bridePhoto', 'couple.groomPhoto'],
  },
  'tpl-ayodhya-royal': {
    folder: 11,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'countdown.date',
    photos: ['gallery.photo1', 'gallery.photo2', 'gallery.photo3', 'events.items[].photo'],
  },
  'tpl-lace-classic': {
    folder: 12,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'countdown.date',
    venue: 'venue.name',
    photos: ['gallery.items[].image'],
  },
  'tpl-embroidered-garden': {
    folder: 13,
    bride: 'couple.brideName',
    groom: 'couple.groomName',
    date: 'countdown.date',
    venue: 'venue.name',
    photos: ['gallery.items[].image'],
  },
};

export const SHARE_TITLE_MAX = 70;
export const SHARE_DESCRIPTION_MAX = 150;
const FALLBACK_TITLE = 'Wedding Invitation';
const FALLBACK_DESCRIPTION = 'You are cordially invited.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const knownTemplates = () => Object.keys(TEMPLATES);

function at(data, path) {
  let value = data;
  for (const key of path.split('.')) value = value && typeof value === 'object' ? value[key] : undefined;
  return value;
}

/** A saved value as plain text: some fields hold markup like `<br>`, and only their first line is wanted. */
function text(data, path) {
  const value = path ? at(data, path) : undefined;
  if (typeof value !== 'string') return '';
  return value
    .split(/<br\s*\/?>/i)[0]
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,]+$/, '')
    .trim();
}

function clip(value, max) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function formatDate(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return month ? `${Number(match[3])} ${month} ${match[1]}` : raw;
}

function coupleNames(template, data) {
  if (template.names) return text(data, template.names);
  return [text(data, template.bride), text(data, template.groom)].filter(Boolean).join(' & ');
}

/**
 * The preview's text: what the user typed, else what their invitation already says.
 * @returns {{title: string, description: string, names: string, date: string}}
 */
export function shareText(templateId, data) {
  const template = TEMPLATES[templateId] ?? {};
  const names = template.folder ? coupleNames(template, data) : '';
  const date = template.date ? formatDate(text(data, template.date)) : '';
  const venue = text(data, template.venue);
  const defaultTitle = names ? `${names}'s Wedding Invitation` : FALLBACK_TITLE;
  const defaultDescription = [date, venue].filter(Boolean).join(' · ') || FALLBACK_DESCRIPTION;
  return {
    title: clip(text(data, 'share.title') || defaultTitle, SHARE_TITLE_MAX),
    description: clip(text(data, 'share.description') || defaultDescription, SHARE_DESCRIPTION_MAX),
    names,
    date,
  };
}

/** Every picture the invitation has for the card, in order of preference. May include sample images. */
export function sharePhotos(templateId, data) {
  const photos = [];
  for (const path of TEMPLATES[templateId]?.photos ?? []) {
    const [list, field] = path.split('[].');
    if (field) {
      const items = at(data, list);
      if (Array.isArray(items)) for (const item of items) photos.push(item?.[field]);
    } else {
      photos.push(at(data, path));
    }
  }
  return photos.filter((photo) => typeof photo === 'string' && photo.trim());
}

/** The picture the user chose for the preview, if any. */
export function customShareImage(data) {
  const image = at(data, 'share.image');
  return typeof image === 'string' && image.trim() ? image.trim() : '';
}

/** Path of the template's own poster under the media base URL. */
export function posterPath(templateId) {
  const folder = TEMPLATES[templateId]?.folder;
  return folder ? `/invitation-templates/template%20${folder}/card-poster.jpg` : '';
}
