import { type Property, properties as defaultProperties } from "./data";

const STORAGE_KEY = "propwatch_properties";

export function getProperties(): Property[] {
  if (typeof window === "undefined") return defaultProperties;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Initialize with default properties
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProperties));
    return defaultProperties;
  }

  return JSON.parse(stored);
}

export function saveProperties(properties: Property[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
}

export function deleteProperty(id: string): Property[] {
  const properties = getProperties();
  const updated = properties.filter((p) => p.id !== id);
  saveProperties(updated);
  return updated;
}

export function addProperty(
  property: Omit<Property, "id" | "lvr">
): Property[] {
  const properties = getProperties();
  const newProperty: Property = {
    ...property,
    id: crypto.randomUUID(),
    lvr: (property.loanRemaining / property.valuation) * 100,
  };
  const updated = [...properties, newProperty];
  saveProperties(updated);
  return updated;
}
