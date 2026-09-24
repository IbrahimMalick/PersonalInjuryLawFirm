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

export interface AreaIntakeCopy extends IntakeCopy {
  immigration?: ImmigrationExtras;
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

/** The form copy for a firm's practice area. Personal injury is the original copy, untouched. */
export function intakeCopyFor(area: PracticeArea, lang: IntakeLang): AreaIntakeCopy {
  return area === "immigration" ? IMMIGRATION_INTAKE_COPY[lang] : INTAKE_COPY[lang];
}
