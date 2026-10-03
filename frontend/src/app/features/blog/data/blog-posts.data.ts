/**
 * Blog posts — informational content aimed at "wording / message / how to"
 * searches (keyword cluster H). Each post links to a landing page and to
 * templates, passing what it ranks for on to the commercial pages.
 *
 * Plain data rather than Markdown so posts prerender with no parser
 * dependency; `quotes` are copy-ready wording samples rendered as blocks.
 */
export interface BlogSection {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
  /** Wording samples readers can copy. Newlines are preserved. */
  readonly quotes?: readonly string[];
}

export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  /** Meta description, ≤155 chars. */
  readonly description: string;
  readonly keywords: readonly string[];
  /** ISO date. */
  readonly published: string;
  readonly readMinutes: number;
  readonly intro: string;
  readonly sections: readonly BlogSection[];
  /** Landing page path (no leading slash) this post supports. */
  readonly hub: string;
  readonly hubLabel: string;
  /** Template slotIds to recommend. */
  readonly templates: readonly string[];
}

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'wedding-invitation-wording-hindi-english',
    title: 'Wedding Invitation Wording in Hindi & English + Examples',
    description:
      'Ready-to-use wedding invitation wording in English, Hindi and Hinglish — formal, family-led, couple-led and WhatsApp-friendly examples you can copy.',
    keywords: [
      'wedding invitation wording',
      'wedding invitation wording in hindi',
      'marriage invitation message',
      'shaadi card wording',
    ],
    published: '2026-10-03',
    readMinutes: 6,
    intro:
      'The right words set the tone for your whole wedding. Below are invitation wordings for every style — traditional family-led, couple-led, Hindi, Hinglish and short WhatsApp versions — that you can copy, edit and drop straight into your invitation.',
    sections: [
      {
        heading: 'What every wedding invitation should include',
        bullets: [
          'An invocation or blessing, if your family uses one (e.g. Shri Ganeshay Namah)',
          'Who is inviting — usually the parents or the family',
          'The couple’s full names, often with parents’ names',
          'Date, day and time of each function',
          'Venue name and address — ideally with a map link',
          'RSVP details and a contact number',
        ],
      },
      {
        heading: 'Traditional English wording (parents inviting)',
        quotes: [
          'With the blessings of Lord Ganesha\nMr. & Mrs. Rajesh Sharma\nrequest the pleasure of your company\nat the wedding of their son\nArjun\nwith\nPriya\n(daughter of Mr. & Mrs. Suresh Iyer)\non Sunday, 24th January 2027 at 7:00 PM\nThe Leela Palace, Udaipur',
          'Together with their families\nMr. & Mrs. Mahesh Kapoor and Mr. & Mrs. Sanjay Joshi\ncordially invite you to celebrate\nthe marriage of\nVihaan & Meera\nYour presence is our blessing.',
        ],
      },
      {
        heading: 'Hindi wedding invitation wording',
        quotes: [
          '|| श्री गणेशाय नमः ||\nसादर आमंत्रित करते हैं\nहमारे सुपुत्र चि. अर्जुन\nसंग\nआयु. प्रिया\nके शुभ विवाह के पावन अवसर पर\nआपकी गरिमामयी उपस्थिति प्रार्थनीय है।\nदिनांक: 24 जनवरी 2027\nस्थान: लीला पैलेस, उदयपुर',
          'आपके आगमन की प्रतीक्षा में\nशर्मा परिवार',
        ],
      },
      {
        heading: 'Modern couple-led wording',
        quotes: [
          'We’re getting married!\nArjun & Priya invite you to celebrate with us\n24 · 01 · 2027 · Udaipur\nCome for the pheras, stay for the dance floor.',
          'Two hearts, one journey —\nand we’d love you to be there when it begins.\nJoin Diya & Aarav as they say “I do”.',
        ],
      },
      {
        heading: 'Short WhatsApp wording to send with your invitation link',
        paragraphs: [
          'When you share an invitation website on WhatsApp, the message that goes with the link matters. Keep it short and warm — the link carries all the details.',
        ],
        quotes: [
          'Namaste 🙏 With great joy we invite you and your family to the wedding of Arjun & Priya on 24th January 2027 in Udaipur. All the details, venues and RSVP are here: [your link]',
          'Shaadi ka invitation aa gaya! 💍 Arjun weds Priya — 24 Jan 2027, Udaipur. Saari details aur RSVP is link par: [your link]. Aap zaroor aaiyega! ❤️',
        ],
      },
      {
        heading: 'Tips for getting the wording right',
        bullets: [
          'Match the tone to your families — formal for elders, playful for friends',
          'Spell every name exactly as the family uses it; double-check with both sides',
          'Write dates in full (Sunday, 24th January 2027) to avoid confusion',
          'Put each function on its own line or card with its own venue',
          'With an invitation website you can fix a typo after sending — with a printed card you can’t',
        ],
      },
    ],
    hub: 'wedding-invitations',
    hubLabel: 'Create your online wedding invitation',
    templates: ['tpl-maroon-gold-royal', 'tpl-eternal-bond', 'tpl-samarpan-royal'],
  },
  {
    slug: 'haldi-mehndi-sangeet-invitation-messages',
    title: 'Haldi, Mehndi & Sangeet Invitation Messages You Can Copy',
    description:
      'Fun and traditional invitation messages for haldi, mehndi and sangeet functions — in English and Hinglish — plus tips for inviting guests on WhatsApp.',
    keywords: [
      'haldi invitation message',
      'mehndi invitation message',
      'sangeet invitation message',
      'haldi ceremony invitation',
    ],
    published: '2026-10-03',
    readMinutes: 5,
    intro:
      'The pre-wedding functions are where the fun is — and their invitations can be a lot more playful than the main wedding card. Here are messages for the haldi, mehndi and sangeet that you can copy as they are or tweak to your style.',
    sections: [
      {
        heading: 'Haldi invitation messages',
        quotes: [
          'Get ready to turn yellow! 💛\nJoin us for Priya’s Haldi ceremony\nSaturday, 23rd January · 10:00 AM\nDress code: shades of yellow',
          'Haldi ki rasam, apno ka saath —\naap bina adhuri hai yeh baat!\nPlease join us for the Haldi of Arjun\n23 January, 11 AM, Sharma Niwas',
        ],
      },
      {
        heading: 'Mehndi invitation messages',
        quotes: [
          'Rang laayegi mehndi, jab saath honge aap! 🌿\nJoin us for Priya’s Mehndi\nSaturday, 23rd January · 4:00 PM onwards\nThe Garden Lawns',
          'Henna, music and lots of love —\ncome celebrate the Mehndi night of Diya & Aarav.',
        ],
      },
      {
        heading: 'Sangeet invitation messages',
        quotes: [
          'Practise your moves! 💃🕺\nYou’re invited to the Sangeet of Arjun & Priya\nSaturday, 23rd January · 8:00 PM\nThe Grand Hall, Udaipur',
          'Dhol, dance aur dher saari masti —\nSangeet night mein zaroor aana!\nArjun weds Priya · 23 Jan · 8 PM',
        ],
      },
      {
        heading: 'One invitation for every function',
        paragraphs: [
          'Instead of sending a separate card for each function, an invitation website lists the haldi, mehndi, sangeet, wedding and reception together — each with its own time, dress code and venue map. Guests open one link and see the whole schedule, and you can add a dress-code line under each event.',
        ],
      },
      {
        heading: 'Tips',
        bullets: [
          'Mention the dress code or colour for each function — guests love to plan',
          'Say whether the function is family-only or open to all guests',
          'Add a Google Maps link if the venue differs from the wedding',
          'Send function invites 2–3 weeks before the date',
        ],
      },
    ],
    hub: 'wedding-invitations',
    hubLabel: 'Put every function on one invitation',
    templates: ['tpl-rosewood-punjabi', 'tpl-eternal-bond', 'tpl-maroon-gold-royal'],
  },
  {
    slug: 'how-to-send-wedding-invitation-on-whatsapp',
    title: 'How to Send a Wedding Invitation on WhatsApp (The Right Way)',
    description:
      'Step-by-step guide to sending your wedding invitation on WhatsApp — broadcast lists vs groups, message etiquette, timing and why a link beats a PDF.',
    keywords: [
      'how to send wedding invitation on whatsapp',
      'whatsapp wedding invitation',
      'wedding invitation link for whatsapp',
    ],
    published: '2026-10-03',
    readMinutes: 5,
    intro:
      'Most Indian wedding invitations now reach guests on WhatsApp. Done well, it is faster, cheaper and more personal than a printed card. Here is how to do it without spamming groups or sending a 20 MB PDF nobody opens.',
    sections: [
      {
        heading: '1. Send a link, not a heavy file',
        paragraphs: [
          'A PDF or video card has to download before guests can see it — and on a busy phone it often doesn’t. An invitation website is a link: it shows a preview card in the chat and opens instantly in the browser, with music, photos and one-tap venue directions.',
        ],
      },
      {
        heading: '2. Use broadcast lists, not big groups',
        paragraphs: [
          'A broadcast list sends your message to each guest individually, so replies come back to you privately and nobody is added to a noisy group. Create separate lists for close family, relatives, friends and colleagues so you can adjust the wording for each.',
        ],
        bullets: [
          'Open WhatsApp → menu → New broadcast',
          'Add contacts (they must have your number saved to receive it)',
          'Paste your message and invitation link, then send',
        ],
      },
      {
        heading: '3. Personalise the message',
        paragraphs: [
          'A one-line personal greeting makes a forwarded invitation feel like a personal invite.',
        ],
        quotes: [
          'Chachaji, pranam 🙏 Arjun ki shaadi mein aap sabka intezaar rahega. Saari details is link par: [your link]',
          'Hi Neha! We’d love to have you at our wedding 💍 Everything you need — dates, venues and RSVP — is here: [your link]',
        ],
      },
      {
        heading: '4. Get the timing right',
        bullets: [
          'Save the date: 2–3 months before (more for destination weddings)',
          'Main invitation: 4–6 weeks before',
          'Reminder: 3–5 days before each function',
          'Elders: follow up with a phone call — it is still good manners',
        ],
      },
      {
        heading: '5. Track who is coming',
        paragraphs: [
          'Ask guests to RSVP on the invitation itself rather than in chat, so you are not scrolling through hundreds of messages to count heads for the caterer.',
        ],
      },
    ],
    hub: 'wedding-invitations',
    hubLabel: 'Create a WhatsApp-ready invitation link',
    templates: ['tpl-royal-gate', 'tpl-eternal-bond', 'tpl-temple-bells'],
  },
  {
    slug: 'digital-vs-printed-wedding-cards',
    title: 'Digital vs Printed Wedding Cards: Cost & Etiquette',
    description:
      'Comparing digital wedding invitations with printed cards in India — cost, delivery, etiquette for elders and why many couples now do both.',
    keywords: [
      'digital vs printed wedding invitation',
      'e invite vs printed card',
      'digital wedding invitation india',
    ],
    published: '2026-10-03',
    readMinutes: 5,
    intro:
      'Printed cards are a tradition; digital invitations are how most guests actually check the details. Here is an honest comparison to help you decide — and why many families now send both.',
    sections: [
      {
        heading: 'Cost',
        paragraphs: [
          'A good printed card with an envelope, inserts and courier can easily cost ₹100–₹500 per guest, and boxed invitations with sweets cost far more. For 300 families that adds up quickly. A digital invitation website is a one-time cost, no matter how many people you send it to.',
        ],
      },
      {
        heading: 'Delivery and speed',
        paragraphs: [
          'Printed cards take weeks to design, print and deliver, and changes mean a reprint. A digital invitation reaches every guest in seconds — and if the venue or timing changes, you update the same link.',
        ],
      },
      {
        heading: 'Etiquette: is a digital invitation acceptable?',
        paragraphs: [
          'For friends, colleagues and most relatives, yes — it is now the norm. For grandparents and senior elders, many families still hand-deliver a printed card or make a personal call, and send the link as well so they have the venue map and timings on their phone.',
        ],
      },
      {
        heading: 'What a website can do that paper can’t',
        bullets: [
          'Play your music and show your photos',
          'Give one-tap Google Maps directions to every venue',
          'Collect RSVPs automatically',
          'Show a live countdown',
          'Be updated after it is sent',
        ],
      },
      {
        heading: 'Our recommendation',
        paragraphs: [
          'Print a small number of cards for elders and puja, and send a digital invitation website to everyone else. You save money, guests get every detail on their phone, and nobody is left out.',
        ],
      },
    ],
    hub: 'wedding-invitations',
    hubLabel: 'See digital wedding invitation designs',
    templates: ['tpl-samarpan-royal', 'tpl-doorway-modern', 'tpl-chateau-classic'],
  },
  {
    slug: 'wedding-reminder-message-for-guests',
    title: 'Wedding Reminder Messages for Guests (WhatsApp Templates)',
    description:
      'Polite wedding reminder messages to send guests on WhatsApp before the haldi, sangeet, wedding and reception — in English and Hinglish.',
    keywords: [
      'wedding reminder message',
      'wedding reminder message for guests',
      'marriage reminder message whatsapp',
    ],
    published: '2026-10-03',
    readMinutes: 3,
    intro:
      'A friendly reminder a few days before the wedding saves you dozens of “what time is it?” calls. Here are short, polite reminder messages you can send on WhatsApp.',
    sections: [
      {
        heading: 'One week before',
        quotes: [
          'Just one week to go! 🎉 We can’t wait to celebrate with you at Arjun & Priya’s wedding on 24th January in Udaipur. Venue, timings and directions: [your link]',
        ],
      },
      {
        heading: 'A day before a function',
        quotes: [
          'Reminder 💛 Haldi tomorrow at 10 AM at Sharma Niwas. Yellow outfits encouraged! Directions: [your link]',
          'Kal Sangeet hai! 💃 8 baje, The Grand Hall. Location yahan hai: [your link]',
        ],
      },
      {
        heading: 'On the wedding day',
        quotes: [
          'Today’s the day! 💍 Baraat leaves at 6 PM, pheras at 8 PM at The Leela Palace. Directions and parking: [your link]. See you soon!',
        ],
      },
      {
        heading: 'Tips',
        bullets: [
          'Keep reminders short — one line and the link',
          'Mention anything guests must bring or know: dress code, parking, ID for the venue',
          'Use your broadcast lists so replies stay private',
          'If plans change, update your invitation website and send the same link again',
        ],
      },
    ],
    hub: 'wedding-invitations',
    hubLabel: 'Create an invitation you can update anytime',
    templates: ['tpl-eternal-bond', 'tpl-temple-bells', 'tpl-royal-gate'],
  },
  {
    slug: 'save-the-date-ideas',
    title: '10 Save the Date Ideas for Indian Weddings',
    description:
      'Creative save the date ideas for Indian weddings — from scratch-to-reveal digital cards to video teasers — and what to include in your save the date.',
    keywords: [
      'save the date ideas',
      'save the date card online',
      'save the date message for wedding',
    ],
    published: '2026-10-03',
    readMinutes: 4,
    intro:
      'A save the date gives guests a heads-up before the full invitation — especially important for destination weddings and wedding-season dates. Here are ideas that feel special without costing a fortune.',
    sections: [
      {
        heading: 'Ideas',
        bullets: [
          'A scratch-to-reveal digital card that hides the date until guests scratch it',
          'A wax-seal envelope that “opens” on screen',
          'A short pre-wedding photo slideshow with your date at the end',
          'A countdown that starts the day you announce',
          'A map-themed card for destination weddings',
          'A save the date in your family’s language',
          'A playful “Block your calendar!” message for friends',
          'A teaser of your wedding song',
          'A monogram reveal',
          'Pairing the date with the city — “Udaipur · 24.01.27”',
        ],
      },
      {
        heading: 'What to include',
        bullets: [
          'Your names',
          'The date (or dates) and city',
          'A line that the formal invitation will follow',
          'For destination weddings: travel and stay hints',
        ],
      },
      {
        heading: 'Save the date message',
        quotes: [
          'Save the date! 💍 Arjun & Priya are getting married on 24th January 2027 in Udaipur. Formal invitation to follow — block your calendars!',
        ],
      },
    ],
    hub: 'engagement-invitations',
    hubLabel: 'See save-the-date and engagement designs',
    templates: ['tpl-golden-promise', 'tpl-royal-gate', 'tpl-beloved-nikkah'],
  },
  {
    slug: 'nikah-invitation-wording',
    title: 'Nikah Invitation Wording: Islamic Wedding Card Messages',
    description:
      'Nikah and Walima invitation wording in English and Urdu-style phrasing, with Quranic verses often used on Muslim wedding invitations.',
    keywords: [
      'nikah invitation wording',
      'muslim wedding invitation wording',
      'walima invitation message',
      'nikah card message',
    ],
    published: '2026-10-03',
    readMinutes: 4,
    intro:
      'A Nikah invitation often begins with Bismillah and a verse, then invites guests on behalf of the families. Here are wordings for the Nikah and Walima that you can adapt.',
    sections: [
      {
        heading: 'Verses commonly used',
        quotes: [
          '“And among His signs is that He created for you mates from among yourselves, that you may dwell in tranquillity with them, and He has put love and mercy between your hearts.” — Surah Ar-Rum (30:21)',
          '“And We created you in pairs.” — Surah An-Naba (78:8)',
        ],
      },
      {
        heading: 'Nikah invitation wording',
        quotes: [
          'Bismillah ir-Rahman ir-Rahim\nWith the blessings of Allah\nMr. & Mrs. Imran Sheikh\nrequest the honour of your presence\nat the Nikah of their son\nZaid\nwith\nAyesha\n(daughter of Mr. & Mrs. Faisal Khan)\non Friday, 15th August 2027 after Asr prayers\nat Al-Noor Banquets, Lucknow',
        ],
      },
      {
        heading: 'Walima invitation wording',
        quotes: [
          'In celebration of the Nikah of Zaid & Ayesha\nthe Sheikh family invites you to the Walima\nSaturday, 16th August 2027 · 8:00 PM\nThe Grand Courtyard, Lucknow',
        ],
      },
      {
        heading: 'Short WhatsApp message',
        quotes: [
          'Assalamu Alaikum 🤍 With Allah’s blessings, we invite you to the Nikah of Zaid & Ayesha on 15th August in Lucknow. Details and directions: [your link]',
        ],
      },
    ],
    hub: 'wedding-invitations/muslim-nikah',
    hubLabel: 'Create your Nikah invitation online',
    templates: ['tpl-beloved-nikkah', 'tpl-chateau-classic', 'tpl-eternal-bond'],
  },
  {
    slug: 'punjabi-wedding-card-wording',
    title: 'Punjabi Wedding Card Wording & Invitation Messages',
    description:
      'Punjabi wedding invitation wording in English, Punjabi and Hinglish — for the main card, Anand Karaj, sangeet and WhatsApp messages.',
    keywords: [
      'punjabi wedding card wording',
      'punjabi wedding invitation message',
      'anand karaj invitation wording',
    ],
    published: '2026-10-03',
    readMinutes: 4,
    intro:
      'Punjabi weddings are big, warm and loud — and the invitation should feel the same. Here is wording for the main card, the Anand Karaj, the sangeet and the WhatsApp message that goes with your link.',
    sections: [
      {
        heading: 'Main invitation (family-led)',
        quotes: [
          'With the blessings of Waheguru\nSardar Gurmeet Singh & Sardarni Harpreet Kaur\nrequest the pleasure of your company\nat the Anand Karaj of their son\nArjan Singh\nwith\nSimran Kaur\n(daughter of S. Kulwant Singh & Smt. Manjit Kaur)\non Sunday, 7th February 2027 at 10:00 AM\nGurdwara Sri Guru Singh Sabha, Ludhiana',
        ],
      },
      {
        heading: 'Punjabi wording',
        quotes: [
          'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ\nਸਾਡੇ ਸਪੁੱਤਰ ਅਰਜਨ ਸਿੰਘ ਦੇ ਅਨੰਦ ਕਾਰਜ\nਵਿੱਚ ਆਪ ਜੀ ਨੂੰ ਪਰਿਵਾਰ ਸਮੇਤ\nਸ਼ਾਮਲ ਹੋਣ ਦਾ ਨਿੱਘਾ ਸੱਦਾ ਹੈ ਜੀ।',
        ],
      },
      {
        heading: 'Sangeet and cocktail messages',
        quotes: [
          'Balle balle! 🥁 Sangeet night for Arjan & Simran — Saturday, 6th Feb, 8 PM. Dhol, giddha and bhangra till late!',
          'Cocktail night 🍸 Join us as we raise a toast to Arjan & Simran — 5th Feb, 8 PM, Hotel Park Plaza.',
        ],
      },
      {
        heading: 'WhatsApp message with your link',
        quotes: [
          'Sat Sri Akal ji 🙏 Arjan te Simran de viyah di saari jaankari — functions, venue te RSVP — is link te hai: [your link]. Tuhada intezaar rahega!',
        ],
      },
    ],
    hub: 'wedding-invitations/punjabi',
    hubLabel: 'Create your Punjabi wedding invitation',
    templates: ['tpl-rosewood-punjabi', 'tpl-royal-gate', 'tpl-maroon-gold-royal'],
  },
];

export function blogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
