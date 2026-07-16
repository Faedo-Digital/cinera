export interface GastronomiaPlace {
  name: string;
  mapsUrl: string;
  description: string;
  /** Número en formato internacional (ej. +34987123456) para href="tel:..." */
  phoneTel: string;
  /** Dirección física, cuando se conoce */
  address?: string;
}

/** Formato legible para números españoles a partir de phoneTel (+34 y 9 dígitos). */
export function formatSpainPhoneForDisplay(phoneTel: string): string {
  const digits = phoneTel.replace(/\D/g, "");
  const national =
    digits.startsWith("34") && digits.length >= 11
      ? digits.slice(2, 11)
      : digits.length >= 9
        ? digits.slice(-9)
        : digits;
  if (national.length !== 9) return phoneTel.trim();
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 9)}`;
}

export function gastronomiaMapLinkTitle(name: string): string {
  return `Más información sobre ${name}`;
}

export function gastronomiaCallTitle(name: string): string {
  return `Llamar a ${name}`;
}

export const GASTRONOMIA_PLACES: GastronomiaPlace[] = [
  {
    name: "La Hornaguera",
    mapsUrl: "https://maps.app.goo.gl/UcEbKqNvWdoAiURk6",
    description: "Ideal para comidas y cenas. Especialidad en arroces y carnes.",
    phoneTel: "+34987584133",
    address: "N-630, 24660 Ciñera, León",
  },
  {
    name: "Bar Baleo",
    mapsUrl: "https://maps.app.goo.gl/72jtvUyk9UpHvTBR8",
    description: "Ideal para comidas y tapeo",
    phoneTel: "+34987025685",
    address: "Plaza Iglesia, 24660 Ciñera, León",
  },
  {
    name: "Hispano",
    mapsUrl: "https://maps.app.goo.gl/xAEuyqrRGmzcUZ5c6",
    description: "Ideal para comidas y tapeo",
    phoneTel: "+34987665250",
    address: "Plaza Iglesia, 24660 Ciñera, León",
  },
  {
    name: "La Fontona",
    mapsUrl: "https://maps.app.goo.gl/cBgHSiFMKMasDoBb8",
    description: "Ideal para comidas y tapeo",
    phoneTel: "+34987584409",
  },
  {
    name: "El Cid",
    mapsUrl: "https://maps.app.goo.gl/LhRVYZ5buELmRVx39",
    description: "Ideal para comidas y tapeo",
    phoneTel: "+34987584016",
  },
];
