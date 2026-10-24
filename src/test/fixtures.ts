import { type Dataset, type Item, createDataset } from "@/lib/dataset";

export const FIXTURE_ITEMS: readonly Item[] = [
  { id: 1, name: "Digital Thermometer", category: "Diagnostics", price: 19.99, status: "active" },
  { id: 2, name: "digital scale", category: "Nutrition", price: 45.5, status: "inactive" },
  { id: 3, name: "Smart Inhaler", category: "Pharmacy", price: 120, status: "active" },
  { id: 4, name: "Portable Monitor", category: "Cardiology", price: 899.99, status: "active" },
  { id: 5, name: "THERMO Kit", category: "Diagnostics", price: 5, status: "inactive" },
  { id: 6, name: "Pro Stethoscope", category: "Cardiology", price: 249, status: "inactive" },
  { id: 7, name: "Digital Monitor", category: "Cardiology", price: 0.1, status: "active" },
];

export function fixtureDataset(): Dataset {
  return createDataset(FIXTURE_ITEMS);
}

/** Maps result indices back to item ids, which makes assertions readable. */
export function idsOf(dataset: Dataset, indices: Uint32Array): number[] {
  return Array.from(indices, (index) => dataset.ids[index]);
}
