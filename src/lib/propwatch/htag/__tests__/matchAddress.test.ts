import { describe, it, expect } from 'vitest'
import {
  matchesAddress,
  resolveAddressMatch,
  splitStreet,
  type HtagAddressCandidate,
} from '../matchAddress'

const ADDRESS = { street: '4 FOURTH AVENUE', city: 'TOUKLEY', postcode: '2263' }

// Shaped from a real /address/geocode response — note score is null, which is
// what HTAG actually returns.
const candidate = (overrides: Partial<HtagAddressCandidate> = {}): HtagAddressCandidate => ({
  address_key: '4FOURTHAVENUETOUKLEYNSW2263',
  address_label: '4 FOURTH AV, TOUKLEY NSW 2263',
  score: null,
  number_first: '4',
  street_name: 'Fourth',
  locality_name: 'Toukley',
  postcode: '2263',
  loc_pid: 'NSW3961',
  ...overrides,
})

describe('splitStreet', () => {
  it('separates the street number from the name', () => {
    expect(splitStreet('4 FOURTH AVENUE')).toEqual({ number: '4', name: 'FOURTH AVENUE' })
  })

  it('keeps an alpha suffix with the number', () => {
    expect(splitStreet('12A KEIDGES RD')).toEqual({ number: '12A', name: 'KEIDGES RD' })
  })

  it('returns an empty number when the street has none', () => {
    expect(splitStreet('KEIDGES RD').number).toBe('')
  })
})

describe('matchesAddress', () => {
  it('matches an exact candidate even though score is null', () => {
    expect(matchesAddress(candidate(), ADDRESS)).toBe(true)
  })

  it('rejects a different street number on the same street', () => {
    expect(matchesAddress(candidate({ number_first: '40' }), ADDRESS)).toBe(false)
  })

  it('rejects a different suburb', () => {
    expect(matchesAddress(candidate({ locality_name: 'Newtown' }), ADDRESS)).toBe(false)
  })

  it('rejects a different postcode', () => {
    expect(matchesAddress(candidate({ postcode: '2042' }), ADDRESS)).toBe(false)
  })

  it('matches when HTAG splits the street type off the name', () => {
    // stored "FOURTH AVENUE" vs HTAG street_name "Fourth" + street_type "Avenue"
    expect(matchesAddress(candidate({ street_name: 'Fourth' }), ADDRESS)).toBe(true)
  })

  it('ignores punctuation and case differences', () => {
    expect(
      matchesAddress(candidate({ locality_name: 'toukley', street_name: 'fourth' }), ADDRESS)
    ).toBe(true)
  })

  it('does not match when the stored street has no number', () => {
    expect(matchesAddress(candidate(), { ...ADDRESS, street: 'FOURTH AVENUE' })).toBe(false)
  })

  it('is false for an undefined candidate', () => {
    expect(matchesAddress(undefined, ADDRESS)).toBe(false)
  })
})

describe('resolveAddressMatch', () => {
  it('picks the one match out of a list of same-street candidates', () => {
    const results = [
      candidate({ number_first: '40', address_key: 'a40' }),
      candidate({ number_first: '4', address_key: 'a4' }),
      candidate({ number_first: '41', address_key: 'a41' }),
    ]
    expect(resolveAddressMatch(results, ADDRESS)?.address_key).toBe('a4')
  })

  it('returns null when nothing matches', () => {
    expect(resolveAddressMatch([candidate({ number_first: '99' })], ADDRESS)).toBeNull()
  })

  it('returns null when two candidates both match, rather than guessing', () => {
    const dupes = [candidate({ address_key: 'x' }), candidate({ address_key: 'y' })]
    expect(resolveAddressMatch(dupes, ADDRESS)).toBeNull()
  })

  it('returns null for an empty result set', () => {
    expect(resolveAddressMatch([], ADDRESS)).toBeNull()
  })
})

describe('real /address/geocode payloads (captured 2026-09-09)', () => {
  // Fixtures are the literal `results` arrays HTAG returned for four real
  // properties. Every candidate has score: null — the case the old
  // `score >= 0.8` gate could never handle.
  const CASES: {
    name: string
    address: { street: string; city: string; postcode: string }
    expect: string
    candidates: HtagAddressCandidate[]
  }[] = [
  {
    "name": "Toukley House",
    "address": {
      "street": "4 FOURTH AVENUE",
      "city": "Toukley",
      "postcode": "2263"
    },
    "expect": "4FOURTHAVENUETOUKLEYNSW2263",
    "candidates": [
      {
        "address_key": "4FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "4 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "4",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "40FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "40 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "40",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "41FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "41 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "41",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "24FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "24 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "24",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "14FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "14 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "14",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "34FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "34 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "34",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "2FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "2 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "2",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "1FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "1 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "1",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "3FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "3 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "3",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      },
      {
        "address_key": "5FOURTHAVENUETOUKLEYNSW2263",
        "address_label": "5 FOURTH AV, TOUKLEY NSW 2263",
        "score": null,
        "number_first": "5",
        "street_name": "Fourth",
        "locality_name": "Toukley",
        "postcode": "2263",
        "loc_pid": "NSW3961"
      }
    ]
  },
  {
    "name": "Ferndale House",
    "address": {
      "street": "61 FERNDALE STREET",
      "city": "Newtown",
      "postcode": "2042"
    },
    "expect": "61FERNDALESTREETNEWTOWNNSW2042",
    "candidates": [
      {
        "address_key": "61FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "61 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "61",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "1FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "1 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "1",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "21FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "21 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "21",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "11FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "11 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "11",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "31FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "31 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "31",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "41FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "41 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "41",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "51FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "51 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "51",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "3FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "3 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "3",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "5FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "5 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "5",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      },
      {
        "address_key": "7FERNDALESTREETNEWTOWNNSW2042",
        "address_label": "7 FERNDALE ST, NEWTOWN NSW 2042",
        "score": null,
        "number_first": "7",
        "street_name": "Ferndale",
        "locality_name": "Newtown",
        "postcode": "2042",
        "loc_pid": "NSW2986"
      }
    ]
  },
  {
    "name": "Goodna House",
    "address": {
      "street": "43 BELLEVUE ROAD",
      "city": "Goodna",
      "postcode": "4300"
    },
    "expect": "43BELLEVUEROADGOODNAQLD4300",
    "candidates": [
      {
        "address_key": "43BELLEVUEROADGOODNAQLD4300",
        "address_label": "43 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "43",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "4BELLEVUEROADGOODNAQLD4300",
        "address_label": "4 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "4",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "3BELLEVUEROADGOODNAQLD4300",
        "address_label": "3 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "3",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "45BELLEVUEROADGOODNAQLD4300",
        "address_label": "45 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "45",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "47BELLEVUEROADGOODNAQLD4300",
        "address_label": "47 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "47",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "49BELLEVUEROADGOODNAQLD4300",
        "address_label": "49 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "49",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "13BELLEVUEROADGOODNAQLD4300",
        "address_label": "13 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "13",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "23BELLEVUEROADGOODNAQLD4300",
        "address_label": "23 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "23",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "33BELLEVUEROADGOODNAQLD4300",
        "address_label": "33 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "33",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      },
      {
        "address_key": "53BELLEVUEROADGOODNAQLD4300",
        "address_label": "53 BELLEVUE RD, GOODNA QLD 4300",
        "score": null,
        "number_first": "53",
        "street_name": "Bellevue",
        "locality_name": "Goodna",
        "postcode": "4300",
        "loc_pid": "QLD1208"
      }
    ]
  },
  {
    "name": "Bellbird Park House",
    "address": {
      "street": "40 KEIDGES ROAD",
      "city": "Bellbird Park",
      "postcode": "4300"
    },
    "expect": "40KEIDGESROADBELLBIRDPARKQLD4300",
    "candidates": [
      {
        "address_key": "40KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "40 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "40",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "42KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "42 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "42",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "44KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "44 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "44",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "46KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "46 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "46",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "48KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "48 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "48",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "30KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "30 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "30",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "50KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "50 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "50",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "LOT 6 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "422KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "KEIDGES GROVE UNIT 4 22 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "22",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      },
      {
        "address_key": "6KEIDGESROADBELLBIRDPARKQLD4300",
        "address_label": "6 KEIDGES RD, BELLBIRD PARK QLD 4300",
        "score": null,
        "number_first": "6",
        "street_name": "Keidges",
        "locality_name": "Bellbird Park",
        "postcode": "4300",
        "loc_pid": "QLD218"
      }
    ]
  }
]

  for (const c of CASES) {
    it(`resolves ${c.name} to the exact dwelling out of ${'${c.candidates.length}'} candidates`, () => {
      expect(resolveAddressMatch(c.candidates, c.address)?.address_key).toBe(c.expect)
    })
  }

  it('every real candidate has a null score, so score-based gating cannot work', () => {
    const scores = CASES.flatMap((c) => c.candidates.map((x) => x.score))
    expect(scores.length).toBeGreaterThan(30)
    expect(scores.every((s) => s === null)).toBe(true)
  })
})
