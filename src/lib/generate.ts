import { type Dataset } from "./dataset";
import { createRandom, pick, randomInt } from "./random";

export const ITEM_COUNT = 100_000;
export const DEFAULT_SEED = 20_240_601;

export const CATEGORIES = [
  "Cardiology",
  "Dentistry",
  "Dermatology",
  "Diagnostics",
  "Laboratory",
  "Neurology",
  "Nutrition",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Pharmacy",
  "Physiotherapy",
] as const;

const ADJECTIVES = [
  "Advanced",
  "Compact",
  "Digital",
  "Disposable",
  "Ergonomic",
  "Flexible",
  "Portable",
  "Premium",
  "Rapid",
  "Reusable",
  "Smart",
  "Sterile",
  "Wireless",
  "Classic",
  "Pro",
  "Ultra",
  "Eco",
  "Silent",
  "Precision",
  "Mini",
] as const;

const NOUNS = [
  "Thermometer",
  "Stethoscope",
  "Monitor",
  "Bandage",
  "Syringe",
  "Scanner",
  "Inhaler",
  "Brace",
  "Lens",
  "Kit",
  "Mask",
  "Glove",
  "Scale",
  "Pump",
  "Nebulizer",
  "Oximeter",
  "Splint",
  "Tablet",
  "Capsule",
  "Sensor",
] as const;

const MIN_PRICE_CENTS = 100; // 1.00
const MAX_PRICE_CENTS = 500_000; // 5,000.00
const ACTIVE_RATIO = 0.7;

/**
 * Generates `count` deterministic mock items, writing straight into the
 * columnar arrays so no intermediate `Item` objects are ever allocated.
 */
export function generateDataset(count: number = ITEM_COUNT, seed: number = DEFAULT_SEED): Dataset {
  const random = createRandom(seed);
  const ids = new Uint32Array(count);
  const names = new Array<string>(count);
  const searchNames = new Array<string>(count);
  const categoryCodes = new Uint8Array(count);
  const priceCents = new Uint32Array(count);
  const active = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const name = `${pick(random, ADJECTIVES)} ${pick(random, NOUNS)} ${randomInt(random, 100, 999)}`;
    ids[i] = i + 1;
    names[i] = name;
    searchNames[i] = name.toLowerCase();
    categoryCodes[i] = randomInt(random, 0, CATEGORIES.length - 1);
    priceCents[i] = randomInt(random, MIN_PRICE_CENTS, MAX_PRICE_CENTS);
    active[i] = random() < ACTIVE_RATIO ? 1 : 0;
  }

  return { size: count, ids, names, searchNames, categories: CATEGORIES, categoryCodes, priceCents, active };
}
