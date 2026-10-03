import { CONTACT_EMAIL, CONTACT_PHONE } from '../../../core/constants/app.constants';

const CONTACT_LINE = `${CONTACT_EMAIL}, ${CONTACT_PHONE}, or WhatsApp on the same number`;

/** Static copy for the public legal pages. */
export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LegalDocument {
  readonly slug: 'privacy' | 'terms';
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
  readonly relatedPath: string;
  readonly relatedLabel: string;
}

const UPDATED = '2 October 2026';
/** Privacy changes separately from the terms (Google Analytics, 3 Oct 2026). */
const PRIVACY_UPDATED = '3 October 2026';

export const PRIVACY_POLICY: LegalDocument = {
  slug: 'privacy',
  eyebrow: 'Legal',
  title: 'Privacy Policy',
  description:
    'How theinvitely.in collects, uses, and shares information when you create an account, design an invitation, or visit a published page.',
  updated: PRIVACY_UPDATED,
  intro:
    'This policy explains what theinvitely.in collects when you create an account, design an invitation website, pay to publish it, or open a page we host. It covers theinvitely.in and the invitation pages created with it.',
  relatedPath: '/terms',
  relatedLabel: 'Read the Terms and Conditions',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        'theinvitely.in is a platform for creating and publishing personalised invitation websites for weddings, engagements, and other occasions. In this policy, “we” and “us” mean the operator of that platform.',
        `Privacy questions can be sent to ${CONTACT_LINE}.`,
      ],
    },
    {
      heading: 'Information you give us',
      paragraphs: ['Depending on how you use the product, we collect:'],
      bullets: [
        'Account details: first name, last name, email address, and password. If you sign in with Google, we receive the basic profile Google shares, such as your name and email.',
        'Invitation content: the text, dates, venue details, maps, photos, music, and other material you add in the editor.',
        'Guest responses: RSVPs and messages submitted on a published invitation, when that page collects them. The invitation owner can see those responses.',
        'Payment details: paid publishing is processed by Razorpay. We receive the amount, currency, payment status, and a payment reference so we can publish the invitation. We do not receive or store your full card number, UPI PIN, or similar credentials.',
        'Messages you send us by email or phone, using the contact details above.',
      ],
    },
    {
      heading: 'Information collected as you use the site',
      paragraphs: ['We also store a small amount of technical information needed to run the product:'],
      bullets: [
        'A sign-in session so you stay logged in.',
        'Your light or dark theme preference, saved in this browser.',
        'Editor cache data saved in this browser so a draft can be restored.',
        'Standard server logs, such as IP address, browser type, and the page requested, used to operate and protect the service.',
        'Usage analytics from Google Analytics on our website pages: the pages you view, how you arrived (for example a search engine or a link), your device and browser type, and your approximate location. Google Analytics sets cookies in your browser to do this. It is not used on published invitation pages, so guests who open an invitation are not tracked.',
      ],
    },
    {
      heading: 'How we use information',
      paragraphs: ['We use this information to:'],
      bullets: [
        'Create and protect your account.',
        'Save, preview, and publish your invitation.',
        'Take a one-time payment and confirm that a paid invitation can go live.',
        'Show guest RSVPs to the person who owns the invitation.',
        'Reply to you and keep the service reliable and secure.',
        'Meet legal and tax duties, including keeping a record of completed payments.',
      ],
    },
    {
      heading: 'What we do not do',
      paragraphs: [
        'We do not sell personal information. We do not use your invitation content or guest RSVPs for advertising.',
      ],
    },
    {
      heading: 'Published invitations are meant to be seen',
      paragraphs: [
        'A published invitation is a page you share. Anyone with the link can see the names, dates, photos, venue details, and other content you placed on it. Share the link only with people you want to invite, and do not publish information you are not willing for those guests — or anyone they forward the link to — to see.',
      ],
    },
    {
      heading: 'Who we share information with',
      paragraphs: [
        'We share information only as needed to run theinvitely.in:',
      ],
      bullets: [
        'Supabase, which provides sign-in and stores account data.',
        'Razorpay, which processes payments.',
        'Google, which provides Google Analytics and processes the usage data described above under its own privacy policy.',
        'The hosting providers that serve the website and published invitations.',
        'Guests who open an invitation you have published.',
        'Authorities, when the law requires us to disclose information.',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'We keep account and invitation data while your account or published invitation is active. If you ask us to delete your account, we delete or anonymise the personal information we hold, except records we must retain for legal, tax, or security reasons — for example a completed payment.',
        'Drafts stored only in your browser remain there until you clear that browser’s storage.',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        `You can edit the invitation content you control, and you can ask us to access, correct, or delete personal information we hold about you. Reach us at ${CONTACT_LINE}, and include the account email you used. Where the Digital Personal Data Protection Act, 2023 applies, you may also raise a grievance with us first, and then with the Data Protection Board of India if it is not resolved.`,
        'You can stop Google Analytics from collecting your usage data by blocking cookies for this site in your browser, or by installing the Google Analytics opt-out browser add-on.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'theinvitely.in is for adults creating invitations. Do not create an account if you are under 18. If you believe a child has given us personal information, contact us and we will delete it.',
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'We use access controls and encrypted connections to protect account and invitation data. No online service can promise perfect security. Use a unique password, and treat a share link as private if the invitation is only for invited guests.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'We will post any update on this page and change the date above. If a change materially affects how we use personal information, we will take reasonable steps to tell account holders.',
      ],
    },
  ],
};

export const TERMS_AND_CONDITIONS: LegalDocument = {
  slug: 'terms',
  eyebrow: 'Legal',
  title: 'Terms and Conditions',
  description:
    'The agreement for using theinvitely.in to design, pay for, and publish an invitation website.',
  updated: UPDATED,
  intro:
    'These terms are the agreement between you and theinvitely.in for the website, the editor, the templates, and the invitation pages you publish. Creating an account, or publishing an invitation, means you accept these terms and the Privacy Policy.',
  relatedPath: '/privacy',
  relatedLabel: 'Read the Privacy Policy',
  sections: [
    {
      heading: 'The service',
      paragraphs: [
        'theinvitely.in lets you choose an invitation template, customise it with your own details, preview it, and publish a shareable website. Some templates publish for free. Others require a one-time payment before the invitation goes live. A successful payment covers that invitation. It is not a subscription.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'You need an account to save and publish. You agree to give your real name and a working email address, to keep your login details to yourself, and to tell us if you believe someone else is using your account. You are responsible for activity under your account.',
        'You must be at least 18 to create an account.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'You keep ownership of the text, photos, music, and other material you upload. You give theinvitely.in permission to host, display, back up, and deliver that material solely so we can preview, publish, and operate your invitation.',
        'You confirm that you have the right to upload and publish everything you add, including photographs and music, and that doing so does not infringe anyone else’s rights or privacy.',
      ],
    },
    {
      heading: 'Templates and our property',
      paragraphs: [
        'Template designs, layouts, graphics, and the theinvitely.in name and logo belong to us or our licensors. Publishing an invitation gives you the right to use the chosen template for that invitation. It does not transfer the template itself. You may not copy a template to build another product, or resell the template on its own.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: ['You agree not to:'],
      bullets: [
        'Publish content that is unlawful, infringing, hateful, sexually exploitative, or deceptive.',
        'Harass anyone, or collect guest information for a purpose other than the event.',
        'Upload malware, attempt to break into the service, or overload it.',
        'Misrepresent who you are, or imply that theinvitely.in hosts or endorses an event it does not.',
      ],
    },
    {
      heading: 'Payments and publishing',
      paragraphs: [
        'Paid publishing is a one-time charge processed by Razorpay. The price and currency are shown before you pay. When the payment succeeds, we publish the invitation. A template marked free goes live without a charge.',
        'A published invitation is delivered as soon as it goes live. If we take payment and then fail to publish, contact us and we will either publish the invitation or refund that payment. Where Indian consumer law requires a refund beyond that, we will honour it.',
      ],
    },
    {
      heading: 'What guests see',
      paragraphs: [
        'You choose the content and you choose who receives the link. Guests do not need an account to view a published page. You are responsible for the accuracy of the event details and for RSVP information your page collects from guests.',
      ],
    },
    {
      heading: 'Availability',
      paragraphs: [
        'We work to keep theinvitely.in available, but we do not guarantee uninterrupted access. We may change or retire a template or feature. If we need to take down an invitation that is already live, we will tell the account holder first when that is practical.',
      ],
    },
    {
      heading: 'Stopping the service',
      paragraphs: [
        'You may stop using theinvitely.in at any time and ask us to delete your account. We may suspend or close an account that breaks these terms, puts other people at risk, or that we are required to close by law. If we close an account for a reason other than your breach, we will refund any payment for an invitation we have not published.',
      ],
    },
    {
      heading: 'Disclaimers',
      paragraphs: [
        'The service is provided as available. We do not warrant that every device will display a page identically, or that maps, music, and other third-party elements will always load. Arrangements for the event itself are between you and your guests.',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        'To the extent the law allows, theinvitely.in is not liable for indirect or consequential loss, or for loss caused by how a guest uses a link you shared. Our total liability for a claim about a particular invitation is limited to the amount you paid us for that invitation. Nothing in these terms limits liability that cannot legally be limited, including liability for fraud.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These terms are governed by the laws of India. The courts of India have jurisdiction. This does not take away mandatory rights you have as a consumer where you live.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'We may update these terms by posting a new version on this page. Continued use of the service after the update means the new terms apply. If a change materially reduces your rights, we will give account holders notice when that is practical.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these terms: ${CONTACT_LINE}.`],
    },
  ],
};

export const LEGAL_DOCUMENTS = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_AND_CONDITIONS,
} as const;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;
