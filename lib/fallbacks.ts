import type { ModelOutput } from "./schema";

// Cached pre-computed extraction results, one per seeded lead. Used when the
// live API call fails twice (or no API key is configured) so the demo never
// dead-ends on camera. Falling back is logged to the server console only.
//
// Incident dates are computed relative to "now" at reset so SOL math always
// looks sane regardless of the recording date.

function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// Most recent occurrence of a weekday (0=Sun..6=Sat) strictly before today.
function lastWeekdayISO(weekday: number): string {
  const d = new Date();
  let back = (d.getDay() - weekday + 7) % 7;
  if (back === 0) back = 7;
  return daysAgoISO(back);
}

export function fallbackFor(leadId: string): ModelOutput | null {
  const table: Record<string, () => ModelOutput> = {
    "lead-voicemail-vasquez": () => ({
      caseType: "motor_vehicle",
      incidentDate: daysAgoISO(1),
      incidentLocation: "Atlantic Ave at Bond or Boerum St, Brooklyn, NY (caller unsure of cross street)",
      claimant: {
        name: "Danielle Vasquez",
        phone: "(347) 555-0119",
        email: null,
        preferredLanguage: "en",
      },
      injuryDescription: "Neck and lower back pain; ER diagnosed whiplash, MRI ordered",
      treatmentStatus: "er_visit",
      liabilityClarity: "clear",
      liabilityNote: "Rear-end collision while stopped at a red light — liability presumptively on the trailing driver.",
      otherPartyInfo: { name: null, insurer: "GEICO (per caller)", policyLimits: null },
      priorRepresentation: false,
      jurisdiction: "NY",
      priorityScore: 92,
      scoreRationale: "Clear-liability rear-end crash with a same-night ER visit and an identified insurer — exactly the case a firm signs before breakfast.",
      routing: "sign_now",
      missingInfo: [
        "Exact cross street (Bond St or Boerum Pl?)",
        "Police report / accident number from the officer's paperwork",
        "Other driver's name and policy number",
        "Vehicle damage photos and current location of the car",
      ],
      confidence: 0.93,
      needsHumanReview: false,
      draftReply:
        "Hi Danielle — this is the intake team at Reyes & Cole Injury Law. We got your voicemail overnight, and we're sorry you're dealing with this; a crash and an ER visit in the same night is a lot. You did the right things — you got checked out, and you kept the officer's paperwork. An attorney from our office will call you this morning at (347) 555-0119. Until then, three small things that help: keep your discharge papers from Brooklyn Methodist, hold off on car repairs for now, and if the other driver's insurance company calls, you don't have to give them a statement. If there's a better time to reach you, just tell us. We're here.",
    }),

    "lead-sms-bqe": () => ({
      caseType: "motor_vehicle",
      incidentDate: null,
      incidentLocation: "Brooklyn-Queens Expressway (no exit or direction given)",
      claimant: { name: null, phone: "(929) 555-0187", email: null, preferredLanguage: "en" },
      injuryDescription: "Neck pain reported; nothing further",
      treatmentStatus: "unknown",
      liabilityClarity: "unclear",
      liabilityNote: "Rear-end collisions usually favor the struck driver, but nothing about this one is confirmed yet.",
      otherPartyInfo: { name: null, insurer: null, policyLimits: null },
      priorRepresentation: "unknown",
      jurisdiction: "NY",
      priorityScore: 55,
      scoreRationale: "Possible rear-end injury case, but with no name, date, or treatment information it can't be evaluated yet.",
      routing: "nurture",
      missingInfo: [
        "Caller's name",
        "When the crash happened",
        "Whether they've seen a doctor or been to an ER",
        "Where on the BQE it happened / whether police responded",
        "Other driver's information",
        "Whether they've already spoken to a lawyer",
      ],
      confidence: 0.74,
      needsHumanReview: false,
      draftReply:
        "This is Reyes & Cole Injury Law — we got your message about being rear-ended on the BQE, and we're sorry about your neck. If you haven't been checked by a doctor yet, please do that first; it matters for your health and for any claim. When you have a moment, reply with your name, when the crash happened, and whether you've gotten medical care — that's enough for us to tell you where you stand. This line is answered around the clock.",
    }),

    "lead-webform-tony": () => ({
      caseType: "motor_vehicle",
      incidentDate: null,
      incidentLocation: null,
      claimant: { name: "Tony", phone: null, email: null, preferredLanguage: "en" },
      injuryDescription: null,
      treatmentStatus: "unknown",
      liabilityClarity: "unclear",
      liabilityNote: "Nothing is known beyond the words 'car accident'.",
      otherPartyInfo: { name: null, insurer: null, policyLimits: null },
      priorRepresentation: "unknown",
      jurisdiction: null,
      priorityScore: 28,
      scoreRationale: "A first name and the words 'car accident' — could be anything, and there's currently no way to reach him.",
      routing: "nurture",
      missingInfo: [
        "Any contact information — the form has no phone or email",
        "Last name",
        "When and where the accident happened",
        "Injuries and medical treatment",
        "Whether Tony was driver, passenger, or pedestrian",
      ],
      confidence: 0.4,
      needsHumanReview: true,
      draftReply:
        "Hi Tony — thanks for reaching out to Reyes & Cole Injury Law about your car accident. We'd like to help, but the form came through without a phone number or email, so right now we have no way to reach you. If you see this, reply with a number where we can call you, or tell us when and where the accident happened and whether you've seen a doctor. Whenever you write back — day or night — someone will pick it up.",
    }),

    "lead-whatsapp-peralta": () => ({
      caseType: "premises_liability",
      incidentDate: lastWeekdayISO(2),
      incidentLocation: "Key Food supermarket, Knickerbocker Ave, Brooklyn, NY",
      claimant: {
        name: "Rosa María Peralta",
        phone: "+1 (718) 555-0164",
        email: null,
        preferredLanguage: "es",
      },
      injuryDescription: "Fall on wet floor; hip injury and small fracture in left wrist per ER",
      treatmentStatus: "er_visit",
      liabilityClarity: "clear",
      liabilityNote: "Liquid on a supermarket floor with no warning sign, and she photographed it — strong premises case.",
      otherPartyInfo: { name: "Key Food (Knickerbocker Ave location)", insurer: null, policyLimits: null },
      priorRepresentation: "unknown",
      jurisdiction: "NY",
      priorityScore: 85,
      scoreRationale: "Documented fall in a commercial store with an ER-confirmed fracture and photos of the hazard — a strong premises liability case.",
      routing: "schedule_consult",
      missingInfo: [
        "Whether the store filed an incident report that night",
        "Names of any store employees or witnesses present",
        "Follow-up orthopedic care for the wrist fracture",
        "Whether she has spoken to the store or its insurer",
      ],
      confidence: 0.9,
      needsHumanReview: false,
      draftReply:
        "Hola Rosa María — le escribimos de Reyes & Cole Injury Law. Recibimos su mensaje esta noche y lamentamos mucho su caída y la fractura en la muñeca. Hizo muy bien en ir a la sala de emergencias y en tomar fotos del piso; eso ayuda mucho. Sí, hablamos español. Una abogada de nuestra oficina la llamará hoy mismo a este número. Mientras tanto: guarde las fotos y todos los recibos, no borre nada, y si el supermercado o una aseguradora la contacta, usted no tiene que dar ninguna declaración. Aquí estamos para ayudarla.",
    }),

    "lead-webform-sobczak": () => ({
      caseType: "not_a_case",
      incidentDate: lastWeekdayISO(6),
      incidentLocation: "His own porch, at his own home",
      claimant: {
        name: "Gary Sobczak",
        phone: "(917) 555-0142",
        email: "gsobczak61@aol.com",
        preferredLanguage: "en",
      },
      injuryDescription: "Knee injury from tripping on a loose porch step",
      treatmentStatus: "unknown",
      liabilityClarity: "unclear",
      liabilityNote: "He owns the property and maintained the step himself — there is no third party to pursue.",
      otherPartyInfo: { name: null, insurer: null, policyLimits: null },
      priorRepresentation: false,
      jurisdiction: "NY",
      priorityScore: 8,
      scoreRationale: "An injury on his own property from a step he owns and knew was loose — there's no negligent third party, so there's no personal-injury claim.",
      routing: "decline",
      missingInfo: [],
      confidence: 0.88,
      needsHumanReview: true,
      draftReply:
        "Hi Gary — thank you for writing to Reyes & Cole Injury Law, and we're sorry about your knee. We looked carefully at what you described. Because the fall happened on your own property, on a step you own, there isn't another party who can be held responsible — and that means this isn't a case our firm can take on. We'd rather tell you that straight than keep you waiting. Two things that may genuinely help: your homeowner's insurance may include coverage for injuries at home, so it's worth a call to your agent; and the NYC Bar Legal Referral Service at (212) 626-7373 can connect you with someone who handles property and insurance questions. We wish you a quick recovery.",
    }),

    "lead-sms-conflict": () => ({
      caseType: "dog_bite",
      incidentDate: lastWeekdayISO(2),
      incidentLocation: "Sidewalk on Hancock St, Brooklyn, NY",
      claimant: { name: "Janelle Rios", phone: "(646) 555-0131", email: null, preferredLanguage: "en" },
      injuryDescription: "Dog bite to forearm, broken skin; treated and given antibiotics at CityMD urgent care",
      treatmentStatus: "saw_doctor_once",
      liabilityClarity: "clear",
      liabilityNote: "Identified owner, prior complaints about the same dog, and a documented bite — liability looks strong.",
      otherPartyInfo: { name: "Marcus Whitfield", insurer: null, policyLimits: null },
      priorRepresentation: false,
      jurisdiction: "NY",
      priorityScore: 76,
      scoreRationale: "Documented bite with medical treatment, a known owner, and prior complaints about the dog — a solid claim if the owner is insured.",
      routing: "schedule_consult",
      missingInfo: [
        "Whether the owner has homeowner's or renter's insurance",
        "Photos of the bite and any animal-control report",
        "Details of the prior complaints about the dog",
        "Follow-up medical care planned",
      ],
      confidence: 0.89,
      needsHumanReview: false,
      draftReply:
        "Hi Janelle — this is Reyes & Cole Injury Law. We got your message about the dog bite on Hancock St, and we're glad you had it treated right away. Keep the photos and any paperwork from CityMD — those matter. Someone from our office will be in touch with next steps shortly. In the meantime, if animal control or an insurance company reaches out, you don't need to give a statement before we talk.",
    }),
  };

  // Any injected break-it lead shares one fallback (ids are randomized).
  if (leadId.startsWith("lead-sms-break")) {
    return {
      caseType: "motor_vehicle",
      incidentDate: null,
      incidentLocation: "Outside his building on Nostrand Ave, Brooklyn, NY",
      claimant: { name: "Curtis Boyd", phone: "(917) 555-0163", email: null, preferredLanguage: "en" },
      injuryDescription: "Shoulder injury after being hit by a delivery van",
      treatmentStatus: "unknown",
      liabilityClarity: "unclear",
      liabilityNote: "A pedestrian struck by a commercial van often has a strong claim, but the date given (13/45/2025) is not a real date and needs confirming.",
      otherPartyInfo: { name: "Delivery van (company not identified)", insurer: null, policyLimits: null },
      priorRepresentation: "unknown",
      jurisdiction: "NY",
      priorityScore: 58,
      scoreRationale: "Pedestrian-versus-commercial-vehicle is worth pursuing, but the incident date is garbled and treatment is unknown.",
      routing: "nurture",
      missingInfo: [
        "The actual date of the incident — '13/45/2025' is not a valid date",
        "Whether he has seen a doctor for the shoulder",
        "The delivery company's name or any markings on the van",
        "Whether police were called",
      ],
      confidence: 0.72,
      needsHumanReview: false,
      draftReply:
        "Hi Curtis — this is Reyes & Cole Injury Law. We got your message about being hit by a delivery van on Nostrand Ave, and we're sorry about your shoulder. If you haven't seen a doctor yet, please do — soon. Two quick things when you reply: the date it happened (the one in your message didn't come through right), and any name or logo you remember on the van. An attorney will call you at this number in the morning.",
    };
  }

  return table[leadId] ? table[leadId]() : null;
}
