import { SHARE_DESCRIPTION_MAX, SHARE_TITLE_MAX } from '../../../../../api/_lib/share-meta.mjs';
import type { SectionSchema } from '../models/template-schema.model';

/** Section key of the link preview's fields in every template's data. */
export const SHARE_SECTION_KEY = 'share';

/**
 * The link preview's fields. Every template gets the same ones, so they're added when a schema loads
 * rather than repeated in each manifest. Each stays empty until the user types: the preview then says
 * what the invitation says (see `api/_lib/share-meta.mjs`).
 */
export const SHARE_SECTION: SectionSchema = {
  key: SHARE_SECTION_KEY,
  label: 'How your link looks on WhatsApp',
  fields: [
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      maxLength: SHARE_TITLE_MAX,
      placeholder: 'Leave empty to create it automatically',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      maxLength: SHARE_DESCRIPTION_MAX,
      placeholder: 'Leave empty to show the date and venue',
    },
    { key: 'image', label: 'Image', type: 'image', uploadOnly: true },
  ],
};
