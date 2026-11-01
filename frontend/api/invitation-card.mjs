import { describeCard, loadInvitation } from './_lib/invitation.mjs';

const WIDTH = 1200;
const HEIGHT = 630;
const PHOTO_BOX = 640; // Room for the photo when the names sit beside it.
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const JPEG_QUALITY = 78; // WhatsApp drops previews whose image is too heavy.

async function fetchImage(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`image answered ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('image too large');
  return bytes;
}

/**
 * The whole picture on a blurred copy of itself. Never cropped: wedding photos are mostly portrait, and
 * cutting one to this wide shape loses the faces. `besideText` leaves the right side free.
 * @returns the card's JPEG, and how far the picture reaches from the left
 */
export async function composePicture(bytes, besideText) {
  // Loaded here so that a library failing to load still ends in the fallback below, not a crash.
  const { default: sharp } = await import('sharp');
  const background = await sharp(bytes)
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .blur(30)
    .modulate({ brightness: 0.5 })
    .toBuffer();
  const boxWidth = besideText ? PHOTO_BOX : WIDTH;
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(boxWidth, HEIGHT, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((boxWidth - info.width) / 2);
  const top = Math.round((HEIGHT - info.height) / 2);
  const picture = await sharp(background)
    .composite([{ input: data, left, top }])
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { picture, pictureEnd: left + info.width };
}

/** The couple's names and date on the free part of the card. */
export async function withNames(picture, pictureEnd, card) {
  const [{ ImageResponse }, { default: sharp }] = await Promise.all([import('@vercel/og'), import('sharp')]);
  const background = `data:image/jpeg;base64,${picture.toString('base64')}`;
  const image = new ImageResponse(
    {
      type: 'div',
      props: {
        style: { position: 'relative', display: 'flex', width: '100%', height: '100%' },
        children: [
          { type: 'img', props: { src: background, width: WIDTH, height: HEIGHT, style: { position: 'absolute', top: 0, left: 0 } } },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                left: pictureEnd,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 40px',
                color: '#fff',
              },
              children: [
                { type: 'div', props: { style: { fontSize: 62, fontWeight: 700, textAlign: 'center', lineHeight: 1.15 }, children: card.names } },
                ...(card.date ? [{ type: 'div', props: { style: { fontSize: 32, marginTop: 20, textAlign: 'center' }, children: card.date } }] : []),
              ],
            },
          },
        ],
      },
    },
    { width: WIDTH, height: HEIGHT },
  );
  return sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: JPEG_QUALITY }).toBuffer();
}

/**
 * The preview image for /i/:slug. It takes only the slug: the picture comes from the invitation's own
 * data, never from the request. When anything fails the preview falls back to the general card.
 */
export async function GET(request) {
  const url = new URL(request.url);
  try {
    const invitation = await loadInvitation(url.searchParams.get('slug') ?? '', 8000);
    if (!invitation) throw new Error('invitation not available');
    const card = describeCard(invitation);
    if (!card.image) throw new Error('no picture for this invitation');
    const besideText = !card.custom && !!card.names;
    const { picture, pictureEnd } = await composePicture(await fetchImage(card.image), besideText);
    // Without the text the card is still their own photo, which beats the general one.
    const body = besideText
      ? await withNames(picture, pictureEnd, card).catch((error) => {
          console.error('[invitation-card]', error);
          return picture;
        })
      : picture;
    return new Response(body, {
      headers: {
        'Content-Type': 'image/jpeg',
        // `v` in the URL changes with the card's content, so this can live long.
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000',
      },
    });
  } catch (error) {
    console.error('[invitation-card]', url.searchParams.get('slug'), error);
    return new Response(null, { status: 302, headers: { Location: '/og/og-default.jpg', 'Cache-Control': 'no-store' } });
  }
}
