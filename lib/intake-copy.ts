// Static copy for the public hosted intake form, in English and Spanish.
// This only changes what the visitor reads while filling out the form —
// their message, the AI's extraction, and the firm's side of things are
// unaffected either way (see lib/guardrails.ts for the reply-language and
// disclaimer logic, which already works regardless of this).

import type { PracticeArea } from "./schema";

export type IntakeLang = "en" | "es";

export function intakeLang(raw: string | undefined): IntakeLang {
  return raw === "es" ? "es" : "en";
}

export interface IntakeCopy {
  intro: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  whatHappened: string;
  attachmentsLabel: string;
  attachmentsHint: string;
  submit: string;
  disclaimer: string;
  confirmTitle: string;
  confirmBody: string;
  emergency: string;
}

export const INTAKE_COPY: Record<IntakeLang, IntakeCopy> = {
  en: {
    intro:
      "Tell us what happened. It's okay if you don't have every detail — we can start with whatever you know.",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    email: "Email",
    whatHappened: "What happened?",
    attachmentsLabel: "Photos or documents (optional)",
    attachmentsHint: "Accident or injury photos, a police report — up to 5 files, 8MB each.",
    submit: "Send to our intake team",
    disclaimer:
      "Submitting this form does not create an attorney-client relationship, and nothing here is legal advice. A member of our team reviews every inquiry personally. If this is a medical emergency, call 911.",
    confirmTitle: "We got your message",
    confirmBody:
      "A member of our team personally reviews every inquiry — day or night. If you gave us a phone number or email, we'll be in touch soon.",
    emergency: "If this is a medical emergency, call 911.",
  },
  es: {
    intro:
      "Cuéntenos qué pasó. No hay problema si no tiene todos los detalles — podemos comenzar con lo que sepa.",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Teléfono",
    email: "Correo electrónico",
    whatHappened: "¿Qué pasó?",
    attachmentsLabel: "Fotos o documentos (opcional)",
    attachmentsHint:
      "Fotos del accidente o de la lesión, un reporte policial — hasta 5 archivos, 8MB cada uno.",
    submit: "Enviar a nuestro equipo de admisión",
    disclaimer:
      "Enviar este formulario no crea una relación abogado-cliente, y nada aquí es asesoría legal. Un miembro de nuestro equipo revisa personalmente cada consulta. Si esto es una emergencia médica, llame al 911.",
    confirmTitle: "Recibimos su mensaje",
    confirmBody:
      "Un miembro de nuestro equipo revisa personalmente cada consulta — de día o de noche. Si nos dio un número de teléfono o correo electrónico, nos pondremos en contacto pronto.",
    emergency: "Si esto es una emergencia médica, llame al 911.",
  },
};

// ── Immigration ──────────────────────────────────────────────────────────────
// Same form, different wording and three extra optional fields. The copy never
// asks for an A-number, passport, or SSN — and says not to send them.

export interface ImmigrationExtras {
  countryLabel: string;
  detainedLabel: string;
  detainedYes: string;
  detainedNo: string;
  detainedUnsure: string;
  keyDateLabel: string;
  keyDateHint: string;
  identifierWarning: string;
}

export interface CriminalExtras {
  /** Shown above the message box — the one thing this form asks NOT to do. */
  narrativeWarning: string;
  inCustodyLabel: string;
  inCustodyYes: string;
  inCustodyNo: string;
  inCustodyUnsure: string;
  courtDateLabel: string;
  courtDateHint: string;
  courtLabel: string;
  courtHint: string;
}

export interface AreaIntakeCopy extends IntakeCopy {
  immigration?: ImmigrationExtras;
  criminal?: CriminalExtras;
}

export const IMMIGRATION_INTAKE_COPY: Record<IntakeLang, AreaIntakeCopy> = {
  en: {
    intro:
      "Tell us about your situation. It's okay if you don't know every detail — we can start with whatever you have, like a notice you received, a date, or a case number.",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    email: "Email",
    whatHappened: "What is going on?",
    attachmentsLabel: "Notices or documents (optional)",
    attachmentsHint: "A notice you received, a receipt — up to 5 files, 8MB each.",
    submit: "Send to our intake team",
    disclaimer:
      "Submitting this form does not create an attorney-client relationship, and nothing here is legal advice. We have not agreed to represent you. A member of our team reviews every inquiry personally. If someone has been detained or a court date is coming up, say so in your message.",
    confirmTitle: "We got your message",
    confirmBody:
      "A member of our team personally reviews every inquiry — day or night. If you gave us a phone number or email, we'll be in touch soon.",
    emergency: "If someone is in immediate danger, call 911.",
    immigration: {
      countryLabel: "Country of citizenship (optional)",
      detainedLabel: "Is anyone currently detained?",
      detainedYes: "Yes",
      detainedNo: "No",
      detainedUnsure: "Not sure",
      keyDateLabel: "Date of an upcoming hearing or notice deadline (optional)",
      keyDateHint: "If you know one — it helps us reach you in time.",
      identifierWarning:
        "Please do not include your A-number, passport number, or Social Security number here.",
    },
  },
  es: {
    intro:
      "Cuéntenos su situación. No hay problema si no tiene todos los detalles — podemos comenzar con lo que tenga, como un aviso que recibió, una fecha o un número de caso.",
    firstName: "Nombre",
    lastName: "Apellido",
    phone: "Teléfono",
    email: "Correo electrónico",
    whatHappened: "¿Qué está pasando?",
    attachmentsLabel: "Avisos o documentos (opcional)",
    attachmentsHint: "Un aviso que recibió, un recibo — hasta 5 archivos, 8MB cada uno.",
    submit: "Enviar a nuestro equipo de admisión",
    disclaimer:
      "Enviar este formulario no crea una relación abogado-cliente, y nada aquí es asesoría legal. No hemos aceptado representarle. Un miembro de nuestro equipo revisa personalmente cada consulta. Si alguien ha sido detenido o se acerca una fecha de corte, indíquelo en su mensaje.",
    confirmTitle: "Recibimos su mensaje",
    confirmBody:
      "Un miembro de nuestro equipo revisa personalmente cada consulta — de día o de noche. Si nos dio un número de teléfono o correo electrónico, nos pondremos en contacto pronto.",
    emergency: "Si alguien está en peligro inmediato, llame al 911.",
    immigration: {
      countryLabel: "País de ciudadanía (opcional)",
      detainedLabel: "¿Hay alguien detenido actualmente?",
      detainedYes: "Sí",
      detainedNo: "No",
      detainedUnsure: "No estoy seguro/a",
      keyDateLabel: "Fecha de una audiencia próxima o de un aviso con plazo (opcional)",
      keyDateHint: "Si conoce alguna — nos ayuda a comunicarnos a tiempo.",
      identifierWarning:
        "Por favor no incluya aquí su número A, número de pasaporte ni número de Seguro Social.",
    },
  },
};

// ── Criminal defense ─────────────────────────────────────────────────────────
// The form asks for who, where, and the court calendar — and asks the visitor
// NOT to describe what happened. Anything written before a lawyer is engaged can
// be used against the person, and the form is not a privileged channel.

export const CRIMINAL_INTAKE_COPY: Record<IntakeLang, AreaIntakeCopy> = {
  en: {
    intro:
      "Tell us who needs help and where they are now. If you are writing for a family member or friend, that is fine. We can start with whatever you know — a name, a jail, a court date.",
    firstName: "Your first name",
    lastName: "Your last name",
    phone: "Best phone number",
    email: "Email",
    whatHappened: "Who was arrested or charged, and where are they now?",
    attachmentsLabel: "Court papers (optional)",
    attachmentsHint: "A court notice or a release paper — up to 5 files, 8MB each.",
    submit: "Send to our intake team",
    disclaimer:
      "Submitting this form does not create an attorney-client relationship, and nothing here is legal advice. We have not agreed to represent you. This form is not a private, privileged conversation. A member of our team reviews every inquiry personally. If someone is in immediate danger, call 911.",
    confirmTitle: "We got your message",
    confirmBody:
      "A member of our team personally reviews every inquiry — day or night. Please keep your phone nearby, and do not describe what happened in a text, email, or voicemail. Your attorney will speak with you directly.",
    emergency: "If someone is in immediate danger, call 911.",
    criminal: {
      narrativeWarning:
        "Please do not describe what happened. Anything you write here can be used against you. Just tell us who and where — your attorney will talk with you directly and in confidence.",
      inCustodyLabel: "Is the person currently in custody?",
      inCustodyYes: "Yes",
      inCustodyNo: "No",
      inCustodyUnsure: "Not sure",
      courtDateLabel: "Next court date (optional)",
      courtDateHint: "If you know it — it helps us reach you in time.",
      courtLabel: "County or court (optional)",
      courtHint: "For example: Harris County, or the name of the court.",
    },
  },
  es: {
    intro:
      "Cuéntenos quién necesita ayuda y dónde está ahora. Si escribe por un familiar o amigo, no hay problema. Podemos comenzar con lo que sepa — un nombre, una cárcel, una fecha de corte.",
    firstName: "Su nombre",
    lastName: "Su apellido",
    phone: "Mejor número de teléfono",
    email: "Correo electrónico",
    whatHappened: "¿Quién fue arrestado o acusado, y dónde está ahora?",
    attachmentsLabel: "Documentos de la corte (opcional)",
    attachmentsHint: "Un aviso de la corte o un papel de liberación — hasta 5 archivos, 8MB cada uno.",
    submit: "Enviar a nuestro equipo de admisión",
    disclaimer:
      "Enviar este formulario no crea una relación abogado-cliente, y nada aquí es asesoría legal. No hemos aceptado representarle. Este formulario no es una conversación privada ni confidencial. Un miembro de nuestro equipo revisa personalmente cada consulta. Si alguien está en peligro inmediato, llame al 911.",
    confirmTitle: "Recibimos su mensaje",
    confirmBody:
      "Un miembro de nuestro equipo revisa personalmente cada consulta — de día o de noche. Por favor mantenga su teléfono cerca y no describa lo sucedido por mensaje de texto, correo electrónico ni mensaje de voz. Su abogado hablará directamente con usted.",
    emergency: "Si alguien está en peligro inmediato, llame al 911.",
    criminal: {
      narrativeWarning:
        "Por favor no describa lo sucedido. Todo lo que escriba aquí puede usarse en su contra. Solo díganos quién y dónde — su abogado hablará con usted directamente y en confidencia.",
      inCustodyLabel: "¿La persona está detenida actualmente?",
      inCustodyYes: "Sí",
      inCustodyNo: "No",
      inCustodyUnsure: "No estoy seguro/a",
      courtDateLabel: "Próxima fecha de corte (opcional)",
      courtDateHint: "Si la conoce — nos ayuda a comunicarnos a tiempo.",
      courtLabel: "Condado o corte (opcional)",
      courtHint: "Por ejemplo: Condado de Harris, o el nombre de la corte.",
    },
  },
};

/** The form copy for a firm's practice area. Personal injury is the original copy, untouched. */
export function intakeCopyFor(area: PracticeArea, lang: IntakeLang): AreaIntakeCopy {
  if (area === "immigration") return IMMIGRATION_INTAKE_COPY[lang];
  if (area === "criminal_defense") return CRIMINAL_INTAKE_COPY[lang];
  return INTAKE_COPY[lang];
}
