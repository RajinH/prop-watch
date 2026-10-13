/**
 * Property type — a user-entered fact (`properties.property_type`). Display
 * only: it picks how a property is drawn on the Portfolio Island and is never
 * read by engine maths.
 */

export const PROPERTY_TYPES = ['house', 'townhouse', 'unit', 'land'] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: 'House',
  townhouse: 'Townhouse',
  unit: 'Unit',
  land: 'Land',
}

/**
 * Map an outside classification (HTAG's `property_type`, a form value) onto
 * ours, or null when it doesn't name one of our types.
 */
export function toPropertyType(raw: string | null | undefined): PropertyType | null {
  switch (raw?.trim().toLowerCase()) {
    case 'house':
      return 'house'
    case 'townhouse':
      return 'townhouse'
    case 'unit':
    case 'apartment':
      return 'unit'
    case 'land':
      return 'land'
    default:
      return null
  }
}
