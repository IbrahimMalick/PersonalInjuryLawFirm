// Static copy for the public hosted intake form, in English and Spanish.
// This only changes what the visitor reads while filling out the form —
// their message, the AI's extraction, and the firm's side of things are
// unaffected either way (see lib/guardrails.ts for the reply-language and
// disclaimer logic, which already works regardless of this).

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
