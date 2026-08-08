import type { Lead, Store } from "./schema";

// Seed inbox for Reyes & Cole Injury Law (fictional). All timestamps are
// relative to the simulated clock, which starts at 2:47 AM. Incident dates in
// the raw text are relative phrases ("last night", "Tuesday") so the demo works
// on any recording date — the extraction prompt is given today's real date.

export const SIM_START = { hour: 2, minute: 47 }; // 2:47 AM

function makeSeeds(): Lead[] {
  return [
    {
      // Lead 1 — the strong case. Voicemail, arrives live at 3:12 AM sim time.
      id: "lead-voicemail-vasquez",
      channel: "voicemail",
      from: "(347) 555-0119",
      displayName: null,
      meta: { durationSec: 107 },
      receivedOffsetMin: 25,
      receivedLabel: "3:12 AM",
      raw: `Yeah, hi, um... I didn't think anybody would pick up, it's like three in the morning. My name is Danielle Vasquez, that's V-A-S-Q-U-E-Z. I was driving home from my shift tonight and this guy just — he came outta nowhere and hit me from behind, right at Atlantic and, um... Bond? Boerum? One of those. The light was red, I was fully stopped, he had to be going like forty-something. Um, the ambulance took me to Brooklyn Methodist, the ER, for my neck and my lower back — they said whiplash and they want me back for an MRI. The cop gave me a paper, the other guy's insurance is GEICO I think. Oh — my number. It's three four seven... five five five... zero one one nine. Please call me back, I don't know what I'm supposed to do about the car or the, the bills or any of it. Okay. Thanks. Bye.`,
      status: "new",
    },
    {
      // Lead 2 — all-caps SMS, almost no detail. Should route to nurture.
      id: "lead-sms-bqe",
      channel: "sms",
      from: "(929) 555-0187",
      displayName: null,
      receivedOffsetMin: -173,
      receivedLabel: "11:54 PM",
      raw: `REAR ENDED ON THE BQE NECK HURTS WHO DO I CALL`,
      status: "new",
    },
    {
      // Lead 3 — the control lead. Web form, mostly empty, unanswered since
      // 8:52 PM. The header counter ticks against this one.
      id: "lead-webform-tony",
      channel: "webform",
      from: "reyescole.law/contact",
      displayName: null,
      meta: {
        formFields: {
          "First name": "Tony",
          "Last name": "",
          Phone: "",
          Email: "",
          "How can we help?": "car accident",
        },
      },
      receivedOffsetMin: -355,
      receivedLabel: "8:52 PM",
      raw: `First name: Tony\nLast name: (blank)\nPhone: (blank)\nEmail: (blank)\nHow can we help?: car accident`,
      status: "new",
    },
    {
      // Lead 4 — WhatsApp, Spanish, slip-and-fall with photos. Reply in Spanish.
      id: "lead-whatsapp-peralta",
      channel: "whatsapp",
      from: "+1 (718) 555-0164",
      displayName: "Rosa María Peralta",
      meta: { photos: ["IMG_4471.jpg", "IMG_4472.jpg", "recibo_farmacia.jpg"] },
      receivedOffsetMin: -81,
      receivedLabel: "1:26 AM",
      raw: `Hola buenas noches, disculpe la hora. Me caí el martes en el supermercado Key Food de la avenida Knickerbocker, había un líquido en el piso y no había ningún letrero de precaución. Me lastimé la cadera y la muñeca izquierda. Fui a la sala de emergencias del hospital Wyckoff y me dijeron que tengo una fractura pequeña en la muñeca. Tengo fotos del piso mojado y del recibo de la farmacia. ¿Ustedes hablan español? Mi nombre es Rosa María Peralta. Gracias.`,
      status: "new",
    },
    {
      // Lead 5 — the non-case. Tripped on his own porch step, no third party.
      // Must route to decline with a courteous referral-out.
      id: "lead-webform-sobczak",
      channel: "webform",
      from: "reyescole.law/contact",
      displayName: null,
      meta: {
        formFields: {
          "First name": "Gary",
          "Last name": "Sobczak",
          Phone: "(917) 555-0142",
          Email: "gsobczak61@aol.com",
          "How can we help?":
            "I tripped on my porch step Saturday and banged up my knee pretty bad. The step has been loose for a while. I own the house. I want to sue somebody over this — the step company or the town or whoever. There is no company name on the step, I looked. Can you get me money for this?",
        },
      },
      receivedOffsetMin: -44,
      receivedLabel: "2:03 AM",
      raw: `First name: Gary\nLast name: Sobczak\nPhone: (917) 555-0142\nEmail: gsobczak61@aol.com\nHow can we help?: I tripped on my porch step Saturday and banged up my knee pretty bad. The step has been loose for a while. I own the house. I want to sue somebody over this — the step company or the town or whoever. There is no company name on the step, I looked. Can you get me money for this?`,
      status: "new",
    },
    {
      // Lead 6 — HIDDEN. The conflict lead: the dog owner she wants to pursue
      // is a current client (data/adverse-parties.json). Surfaced only by the
      // "Run the conflict lead" control.
      id: "lead-sms-conflict",
      channel: "sms",
      from: "(646) 555-0131",
      displayName: null,
      hidden: true,
      receivedOffsetMin: -16,
      receivedLabel: "2:31 AM",
      raw: `Hi, I got bit by my neighbor's dog Tuesday evening on the sidewalk on Hancock St. Broke the skin on my forearm, went to CityMD urgent care, got it cleaned and they gave me antibiotics. I have pictures of the bite. The owner is Marcus Whitfield, he lives two doors down. He's had complaints about this dog before. My name is Janelle Rios.`,
      status: "new",
    },
  ];
}

// The break-it lead is injected on demand, not seeded.
export function makeBreakLead(): Lead {
  return {
    id: `lead-sms-break-${Math.random().toString(36).slice(2, 7)}`,
    channel: "sms",
    from: "(917) 555-0163",
    displayName: null,
    breakIt: true,
    receivedOffsetMin: 0, // stamped by the client with current sim time on inject
    receivedLabel: "",
    raw: `got hit by a delivery van on 13/45/2025 outside my building on nostrand ave. shoulder is messed up. name is curtis boyd call me back 917 555 0163`,
    status: "new",
  };
}

export function freshStore(): Store {
  return {
    seededAt: new Date().toISOString(),
    leads: makeSeeds(),
    activity: [
      { t: "2:47 AM", kind: "info", line: "Nightshift on duty — watching all intake channels" },
    ],
  };
}
