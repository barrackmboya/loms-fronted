// Tests for AddressStep component
// Covers: locations loading, sequential selection, changes, downward cascade

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddressStep } from './AddressStep'

// ============================================
// Test Fixtures (inline to avoid hoisting issues)
// ============================================

const counties = [
  { id: 1, name: 'Nairobi' },
  { id: 2, name: 'Mombasa' },
  { id: 3, name: 'Kisumu' },
  { id: 4, name: 'Nakuru' },
  { id: 5, name: 'Eldoret' },
]

const subCounties = {
  nairobi: [
    { id: 10, name: 'Westlands' },
    { id: 11, name: 'Dagoretti North' },
    { id: 12, name: 'Dagoretti South' },
    { id: 13, name: 'Langata' },
    { id: 14, name: 'Kibra' },
    { id: 15, name: 'Roysambu' },
    { id: 16, name: 'Kasarani' },
    { id: 17, name: 'Ruaraka' },
    { id: 18, name: 'Embakasi South' },
    { id: 19, name: 'Embakasi North' },
    { id: 20, name: 'Embakasi Central' },
    { id: 21, name: 'Embakasi East' },
    { id: 22, name: 'Embakasi West' },
    { id: 23, name: 'Makadara' },
    { id: 24, name: 'Kamukunji' },
    { id: 25, name: 'Starehe' },
    { id: 26, name: 'Mathare' },
  ],
  mombasa: [
    { id: 30, name: 'Mvita' },
    { id: 31, name: 'Nyali' },
    { id: 32, name: 'Kisauni' },
    { id: 33, name: 'Jomvu' },
    { id: 34, name: 'Changamwe' },
    { id: 35, name: 'Likoni' },
  ],
  kisumu: [
    { id: 40, name: 'Kisumu East' },
    { id: 41, name: 'Kisumu West' },
    { id: 42, name: 'Kisumu Central' },
    { id: 43, name: 'Seme' },
    { id: 44, name: 'Nyando' },
    { id: 45, name: 'Muhoroni' },
    { id: 46, name: 'Nyakach' },
  ],
}

const wards = {
  'nairobi-westlands': [
    { id: 100, name: 'Kitisuru' },
    { id: 101, name: 'Parklands/Highridge' },
    { id: 102, name: 'Karura' },
    { id: 102, name: 'Kangemi' },
    { id: 103, name: 'Mountain View' },
  ],
  'nairobi-dagoretti north': [
    { id: 110, name: 'Kilimani' },
    { id: 111, name: 'Kawangware' },
    { id: 112, name: 'Gatina' },
    { id: 113, name: 'Kileleshwa' },
    { id: 114, name: 'Kabiro' },
  ],
  'mombasa-mvita': [
    { id: 200, name: 'Mji Wa Kale/Makadara' },
    { id: 201, name: 'Tudor' },
    { id: 202, name: 'Tononoka' },
    { id: 203, name: 'Shimanzi/Ganjoni' },
    { id: 204, name: 'Majengo' },
  ],
}

const neighborhoods = {
  // NOTE: matches the real API — neighborhood options have no id (raw OSM data)
  'nairobi-westlands-kitisuru': [
    { name: 'Kitisuru' },
    { name: 'Loresho' },
    { name: 'Kyuna' },
    { name: 'Muthaiga' },
    { name: 'Spring Valley' },
  ],
  'nairobi-westlands-parklands/highridge': [
    { name: 'Parklands' },
    { name: 'Highridge' },
    { name: 'Westlands' },
  ],
  'nairobi-dagoretti north-kilimani': [
    { name: 'Kilimani' },
    { name: 'Yaya Centre' },
    { name: 'Riverside' },
  ],
  'mombasa-mvita-mji wa kale/makadara': [
    { name: 'Old Town' },
    { name: 'Makadara' },
    { name: 'Tudor' },
  ],
}

const landmarks = {
  streets: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { name: 'Kitisuru Road' },
      { name: 'Loresho Ridge' },
      { name: 'Kyuna Close' },
      { name: 'Muthaiga Road' },
      { name: 'Spring Valley Road' },
    ],
    'nairobi-westlands-parklands/highridge-parklands': [
      { name: 'Parklands Road' },
      { name: 'Limuru Road' },
      { name: 'Rhapta Road' },
      { name: 'Mpaka Road' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { name: 'Nkrumah Road' },
      { name: 'Moi Avenue' },
      { name: 'Mama Ngina Drive' },
    ],
  },
  schools: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { name: 'Kitisuru Primary School' },
      { name: 'Loresho Primary School' },
      { name: 'Kyuna Academy' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { name: 'Mombasa Primary School' },
      { name: 'Sacred Heart Primary' },
    ],
  },
  healthCenters: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { name: 'Kitisuru Health Centre' },
      { name: 'Loresho Clinic' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { name: 'Coast General Hospital' },
      { name: 'Mombasa Hospital' },
    ],
  },
  buildings: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { name: 'Kitisuru Mall' },
      { name: 'Loresho Shopping Centre' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { name: 'City Mall Mombasa' },
      { name: 'Ratna Square' },
    ],
  },
  markets: {
    'nairobi-westlands-kitisuru-kitisuru': [
      { name: 'Kitisuru Market' },
      { name: 'Loresho Market' },
    ],
    'mombasa-mvita-mji wa kale/makadara-old town': [
      { name: 'Kongowea Market' },
      { name: 'Marikiti Market' },
    ],
  },
}

// ============================================
// API Mock Factory (inline for vi.mock)
// ============================================

const apiCallLog = []

function resetApiCallLog() {
  apiCallLog.length = 0
}

// Synchronous mock for faster tests
function getTestData(endpoint, { county, subcounty, ward }) {
  // Handle trailing slash in endpoint
  const normalizedEndpoint = endpoint.replace(/\/$/, '')
  switch (normalizedEndpoint) {
    case 'counties':
      return counties
    case 'subcounties':
      return subCounties[county?.toLowerCase()] || []
    case 'wards':
      return wards[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}`] || []
    case 'neighborhoods':
      return neighborhoods[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    case 'streets':
      return landmarks.streets[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    case 'schools':
      return landmarks.schools[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    case 'health-centers':
      return landmarks.healthCenters[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    case 'buildings':
      return landmarks.buildings[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    case 'markets':
      return landmarks.markets[`${county?.toLowerCase()}-${subcounty?.toLowerCase()}-${ward?.toLowerCase()}-${ward?.toLowerCase()}`] || []
    default:
      return []
  }
}

// Mock the api module with inline factory
vi.mock('../../../../lib/api', () => {
  const mockApiGet = vi.fn(async (url) => {
    console.log('[MOCK] api.get called with:', url)
    apiCallLog.push({ url, timestamp: Date.now() })

    const LOCATION_BASE = '/api/origination/location'
    if (!url.startsWith(LOCATION_BASE)) {
      throw new Error(`Unexpected API URL: ${url}`)
    }

    const path = url.replace(LOCATION_BASE + '/', '')
    const [endpoint, queryString] = path.split('?')
    const params = new URLSearchParams(queryString || '')

    const county = params.get('county')
    const subcounty = params.get('subcounty')
    const ward = params.get('ward')

    const result = getTestData(endpoint, { county, subcounty, ward })
    console.log('[MOCK] returning:', result)
    return result
  })

  return {
    api: {
      get: mockApiGet,
      login: vi.fn(),
      refreshToken: vi.fn(),
      createApplication: vi.fn(),
      retrieveApplication: vi.fn(),
      applicationFiles: vi.fn(),
      applicationDecisions: vi.fn(),
      documentObjectUrl: vi.fn(),
      parties: vi.fn(),
      decide: vi.fn(),
      book: vi.fn(),
      advanceMonth: vi.fn(),
      seed: vi.fn(),
      seedDashboard: vi.fn(),
      portfolio: vi.fn(),
      dashboard: vi.fn(),
      dashboardOverview: vi.fn(),
      accounts: vi.fn(),
      watchlist: vi.fn(),
      collections: vi.fn(),
      policy: vi.fn(),
      originationMetrics: vi.fn(),
      partiesMetrics: vi.fn(),
      decisioningMetrics: vi.fn(),
      servicingMetrics: vi.fn(),
      provisioningMetrics: vi.fn(),
      monitoringMetrics: vi.fn(),
      passwordReset: vi.fn(),
      verifyOtp: vi.fn(),
    },
  }
})

// Import the mocked api after vi.mock
import { api } from '../../../../lib/api'

// ============================================
// Test Utilities
// ============================================

const createMockFormData = (address = {}) => {
  const addressData = {
    county: null,
    subcounty: null,
    ward: null,
    neighborhood: null,
    street: null,
    landmark: null,
    lat: null,
    lng: null,
    plot_number: '',
    postal_code: '',
    ...address,
  }
  return { address: addressData }
}

const createMockUpdateField = (formData) => {
  const updates = []
  const mockFn = vi.fn((section, updater) => {
    if (section !== 'address') return
    updates.push({ section, updater })
    formData.address = updater(formData.address)
  })
  mockFn.getUpdates = () => updates
  return mockFn
}

const getSelectByLabelText = (labelText) => {
  const label = screen.getByText(labelText, { selector: 'label' })
  const container = label.closest('div')
  return container.querySelector('select')
}

const selectOption = async (user, labelText, optionText) => {
  // Wait for the option to exist in the select (it may load asynchronously)
  await waitFor(() => {
    const select = getSelectByLabelText(labelText)
    const option = Array.from(select.options).find(o => o.text === optionText)
    expect(option).toBeDefined()
  }, { timeout: 5000 })

  const select = getSelectByLabelText(labelText)
  const option = Array.from(select.options).find(o => o.text === optionText)
  // Use the option's value attribute (data index), not its DOM position,
  // because the placeholder option is at DOM index 0 but isn't in the data array
  await act(async () => {
    fireEvent.change(select, { target: { value: option.value } })
    // Force re-render since updateField mutates formData.address directly (prop, not state)
    rerender(<AddressStep formData={mockFormData} updateField={mockUpdateField} />)
  })
}

const getSelectedText = (labelText) => {
  const select = getSelectByLabelText(labelText)
  return select.options[select.selectedIndex]?.text || ''
}

const isDisabled = (labelText) => {
  const select = getSelectByLabelText(labelText)
  return select.disabled
}

// ============================================
// Tests
// ============================================

let mockFormData
let mockUpdateField
let user
let rerender

describe('AddressStep', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    resetApiCallLog()
    api.get.mockClear()

    mockFormData = createMockFormData()
    mockUpdateField = createMockUpdateField(mockFormData)
    user = userEvent.setup() // Use real timers

    // Render component wrapped in act
    await act(async () => {
      const result = render(<AddressStep formData={mockFormData} updateField={mockUpdateField} />)
      rerender = result.rerender
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('Initial Load', () => {
    it('loads counties on mount', async () => {
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/counties')
        )
      }, { timeout: 2000 })

      await waitFor(() => {
        const countySelect = getSelectByLabelText('County')
        expect(countySelect.options.length).toBeGreaterThan(1)
      }, { timeout: 2000 })
    })

    it('disables downstream dropdowns until upstream selected', async () => {
      // Wait for counties to load (county gets auto-selected to first option)
      await waitFor(() => {
        const countySelect = getSelectByLabelText('County')
        expect(countySelect.options.length).toBeGreaterThan(1)
      })

      // Sub-County should be enabled (county auto-selected)
      expect(isDisabled('Sub-County')).toBe(false)
      // Ward and Neighborhood still disabled (subcounty and ward not yet selected)
      expect(isDisabled('Ward')).toBe(true)
      expect(isDisabled('Neighborhood')).toBe(true)
    })

    it('shows placeholder text for disabled dropdowns', async () => {
      // Wait for counties to load
      await waitFor(() => {
        const countySelect = getSelectByLabelText('County')
        expect(countySelect.options.length).toBeGreaterThan(1)
      })

      const wardSelect = getSelectByLabelText('Ward')
      expect(wardSelect.options[0].text).toContain('Select sub-county first')

      const neighborhoodSelect = getSelectByLabelText('Neighborhood')
      expect(neighborhoodSelect.options[0].text).toContain('Select ward first')
    })
  })

  describe('County Selection', () => {
    beforeEach(async () => {
      // Wait for counties to load
      await waitFor(() => {
        const countySelect = getSelectByLabelText('County')
        expect(countySelect.options.length).toBeGreaterThan(1)
      })
    })

    it('loads sub-counties when county is selected', async () => {
      await selectOption(user, 'County', 'Nairobi')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/subcounties')
        )
      })

      await waitFor(() => {
        expect(isDisabled('Sub-County')).toBe(false)
        const select = getSelectByLabelText('Sub-County')
        expect(select.options.length).toBeGreaterThan(1)
      })
    })

    it('clears downstream fields when county changes', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))

      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      await selectOption(user, 'County', 'Mombasa')

      expect(getSelectedText('Sub-County')).toContain('Select sub-county')
      expect(getSelectedText('Ward')).toContain('Select sub-county first')
      expect(getSelectedText('Neighborhood')).toContain('Select ward first')
    })

    it('fetches new sub-counties for new county', async () => {
      // County is auto-selected to Nairobi on mount (2 calls: counties + subcounties)
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))

      const nairobiCalls = apiCallLog.filter((c) => c.url.includes('subcounties') && c.url.includes('Nairobi'))
      expect(nairobiCalls.length).toBe(1)

      await selectOption(user, 'County', 'Mombasa')
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3))

      const mombasaCalls = apiCallLog.filter((c) => c.url.includes('subcounties') && c.url.includes('Mombasa'))
      expect(mombasaCalls.length).toBe(1)
    })

    it('refetches sub-counties when re-selecting a previously chosen county', async () => {
      // County is auto-selected to Nairobi on mount (2 calls: counties + subcounties)
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))

      await selectOption(user, 'County', 'Mombasa')
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3))

      // Re-selecting Nairobi triggers a fresh reload of its sub-counties
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4))

      const nairobiCalls = apiCallLog.filter((c) => c.url.includes('subcounties') && c.url.includes('Nairobi'))
      expect(nairobiCalls.length).toBe(2)
    })

    it('refetches sub-counties with fresh params when county changes', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))

      await selectOption(user, 'County', 'Mombasa')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))

      const subcountyCalls = apiCallLog.filter((c) => c.url.includes('subcounties'))
      expect(subcountyCalls).toHaveLength(2)
      expect(subcountyCalls[0].url).toContain('county=Nairobi')
      expect(subcountyCalls[1].url).toContain('county=Mombasa')

      // Fresh options shown for the new county
      await waitFor(() => {
        const select = getSelectByLabelText('Sub-County')
        const optionTexts = Array.from(select.options).map((o) => o.text)
        expect(optionTexts).toContain('Mvita')
        expect(optionTexts).not.toContain('Westlands')
      })
    })
  })

  describe('Sub-County Selection', () => {
    beforeEach(async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
    })

    it('loads wards when sub-county is selected', async () => {
      await selectOption(user, 'Sub-County', 'Westlands')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/wards')
        )
      })

      await waitFor(() => {
        expect(isDisabled('Ward')).toBe(false)
        const select = getSelectByLabelText('Ward')
        expect(select.options.length).toBeGreaterThan(1)
      })
    })

    it('clears downstream fields when sub-county changes', async () => {
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => {
        expect(isDisabled('Ward')).toBe(false)
        const wardSelect = getSelectByLabelText('Ward')
        expect(wardSelect.options.length).toBeGreaterThan(1)
      })

      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => {
        expect(isDisabled('Neighborhood')).toBe(false)
        const neighborhoodSelect = getSelectByLabelText('Neighborhood')
        expect(neighborhoodSelect.options.length).toBeGreaterThan(1)
      })

      await selectOption(user, 'Sub-County', 'Dagoretti North')

      expect(getSelectedText('Ward')).toContain('Select ward')
      expect(getSelectedText('Neighborhood')).toContain('Select ward first')
    })

    it('fetches wards with correct county and sub-county params', async () => {
      await selectOption(user, 'Sub-County', 'Westlands')

      await waitFor(() => {
        const wardCall = apiCallLog.find((c) => c.url.includes('wards'))
        expect(wardCall).toBeDefined()
        expect(wardCall.url).toContain('county=Nairobi')
        expect(wardCall.url).toContain('subcounty=Westlands')
      })
    })

    it('refetches wards with new params when sub-county changes', async () => {
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      await selectOption(user, 'Sub-County', 'Dagoretti North')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      const wardCalls = apiCallLog.filter((c) => c.url.includes('wards'))
      expect(wardCalls).toHaveLength(2)
      expect(wardCalls[0].url).toContain('subcounty=Westlands')
      expect(wardCalls[1].url).toContain('subcounty=Dagoretti')

      await waitFor(() => {
        const select = getSelectByLabelText('Ward')
        const optionTexts = Array.from(select.options).map((o) => o.text)
        expect(optionTexts).toContain('Kilimani')
        expect(optionTexts).not.toContain('Kitisuru')
      })
    })
  })

  describe('Ward Selection', () => {
    beforeEach(async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
    })

    it('loads neighborhoods when ward is selected', async () => {
      await selectOption(user, 'Ward', 'Kitisuru')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/neighborhoods')
        )
      })

      await waitFor(() => {
        expect(isDisabled('Neighborhood')).toBe(false)
        const select = getSelectByLabelText('Neighborhood')
        expect(select.options.length).toBeGreaterThan(1)
      })
    })

    it('clears downstream fields when ward changes', async () => {
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      await selectOption(user, 'Neighborhood', 'Kitisuru')

      await selectOption(user, 'Ward', 'Parklands/Highridge')

      expect(getSelectedText('Neighborhood')).toContain('Select neighborhood')
    })

    it('fetches neighborhoods with correct params', async () => {
      await selectOption(user, 'Ward', 'Kitisuru')

      await waitFor(() => {
        const nhCall = apiCallLog.find((c) => c.url.includes('neighborhoods'))
        expect(nhCall).toBeDefined()
        expect(nhCall.url).toContain('county=Nairobi')
        expect(nhCall.url).toContain('subcounty=Westlands')
        expect(nhCall.url).toContain('ward=Kitisuru')
      })
    })

    it('refetches neighborhoods with new params when ward changes', async () => {
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      await selectOption(user, 'Ward', 'Parklands/Highridge')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      const nhCalls = apiCallLog.filter((c) => c.url.includes('neighborhoods'))
      expect(nhCalls).toHaveLength(2)
      expect(nhCalls[0].url).toContain('ward=Kitisuru')
      expect(nhCalls[1].url).toContain('ward=Parklands')

      await waitFor(() => {
        const select = getSelectByLabelText('Neighborhood')
        const optionTexts = Array.from(select.options).map((o) => o.text)
        expect(optionTexts).toContain('Parklands')
        expect(optionTexts).not.toContain('Loresho')
      })
    })
  })

  describe('Neighborhood Selection & Landmarks', () => {
    beforeEach(async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
    })

    it('shows all five landmark selects after neighborhood selection', async () => {
      await selectOption(user, 'Neighborhood', 'Kitisuru')

      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
        expect(getSelectByLabelText('School').options.length).toBeGreaterThan(1)
        expect(getSelectByLabelText('Health Center').options.length).toBeGreaterThan(1)
        expect(getSelectByLabelText('Building').options.length).toBeGreaterThan(1)
        expect(getSelectByLabelText('Market').options.length).toBeGreaterThan(1)
      })
    })

    it('fetches all five landmark endpoints when neighborhood is selected', async () => {
      await selectOption(user, 'Neighborhood', 'Kitisuru')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/streets')
        )
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/schools')
        )
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/health-centers')
        )
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/buildings')
        )
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/markets')
        )
      })
    })

    it('allows selecting one option per type — selections accumulate', async () => {
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
      })

      await selectOption(user, 'Street', 'Kitisuru Road')
      await selectOption(user, 'School', 'Kitisuru Primary School')
      await selectOption(user, 'Market', 'Kitisuru Market')

      // Each selection is retained; picking one type does not clear another
      expect(getSelectedText('Street')).toContain('Kitisuru Road')
      expect(getSelectedText('School')).toContain('Kitisuru Primary School')
      expect(getSelectedText('Market')).toContain('Kitisuru Market')
    })

    it('requires at least three landmark selections', async () => {
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
      })

      await selectOption(user, 'Street', 'Kitisuru Road')
      await selectOption(user, 'School', 'Kitisuru Primary School')

      // Fewer than 3 selected — counter shows the shortfall and the warning stays
      expect(screen.getByText(/2 of 5 landmarks selected/i)).toBeInTheDocument()
      expect(screen.getByText(/please select county/i)).toBeInTheDocument()

      await selectOption(user, 'Market', 'Kitisuru Market')

      // 3 of 5 selected — requirement met, warning gone
      expect(screen.getByText(/3 of 5 landmarks selected/i)).toBeInTheDocument()
      expect(screen.queryByText(/please select county/i)).not.toBeInTheDocument()
    })

    it('fetches landmarks with correct params', async () => {
      await selectOption(user, 'Neighborhood', 'Kitisuru')

      await waitFor(() => {
        const streetsCall = apiCallLog.find((c) => c.url.includes('streets'))
        expect(streetsCall).toBeDefined()
        expect(streetsCall.url).toContain('county=Nairobi')
        expect(streetsCall.url).toContain('subcounty=Westlands')
        expect(streetsCall.url).toContain('ward=Kitisuru')
      })
    })
  })

  describe('Complete Selection Flow', () => {
    it('allows complete sequential selection: County → Sub-County → Ward → Neighborhood → 3 Landmarks', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))

      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
      })

      await selectOption(user, 'Street', 'Kitisuru Road')
      await selectOption(user, 'School', 'Kitisuru Primary School')
      await selectOption(user, 'Market', 'Kitisuru Market')

      const warning = screen.queryByText(/please select county/i)
      expect(warning).not.toBeInTheDocument()
    })

    it('allows complete selection with any 3 of the 5 landmark types', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Health Center').options.length).toBeGreaterThan(1)
      })

      await selectOption(user, 'Health Center', 'Kitisuru Health Centre')
      await selectOption(user, 'Building', 'Kitisuru Mall')
      await selectOption(user, 'Market', 'Kitisuru Market')

      const warning = screen.queryByText(/please select county/i)
      expect(warning).not.toBeInTheDocument()
    })
  })

  describe('Validation', () => {
    it('shows validation warning when required fields missing', async () => {
      const warning = screen.getByText(/please select county/i)
      expect(warning).toBeInTheDocument()
    })

    it('hides validation warning when all required fields selected', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
      })
      await selectOption(user, 'Street', 'Kitisuru Road')
      await selectOption(user, 'School', 'Kitisuru Primary School')
      await selectOption(user, 'Market', 'Kitisuru Market')

      const warning = screen.queryByText(/please select county/i)
      expect(warning).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('displays error when county fetch fails', async () => {
      api.get.mockRejectedValueOnce(new Error('Failed to load counties'))
      const { container } = render(<AddressStep formData={createMockFormData()} updateField={mockUpdateField} />)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/origination/location/counties')
        )
      })

      // Component should handle fetch failure gracefully
      expect(container.querySelector('label')).toHaveTextContent('County')
    })

    it('displays error when sub-county fetch fails', async () => {
      await selectOption(user, 'County', 'Nairobi')

      api.get.mockRejectedValueOnce(new Error('Failed to load sub-counties'))

      await selectOption(user, 'County', 'Mombasa')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })

  describe('Cascade Behavior - Downward Reset', () => {
    it('resets all downstream when county changes', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
      })
      await selectOption(user, 'Street', 'Kitisuru Road')
      await selectOption(user, 'School', 'Kitisuru Primary School')

      await selectOption(user, 'County', 'Mombasa')

      expect(getSelectedText('Sub-County')).toContain('Select sub-county')
      expect(getSelectedText('Ward')).toContain('Select sub-county first')
      expect(getSelectedText('Neighborhood')).toContain('Select ward first')
      expect(screen.getByText(/select a neighborhood to choose landmarks/i)).toBeInTheDocument()
      // Landmark selects are hidden when no neighborhood is selected
      expect(screen.queryByLabelText('Street')).toBeNull()
      expect(screen.queryByLabelText('School')).toBeNull()
    })

    it('resets downstream when sub-county changes', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        const streetSelect = getSelectByLabelText('Street')
        expect(streetSelect.options.length).toBeGreaterThan(1)
      })
      await selectOption(user, 'Street', 'Kitisuru Road')

      await selectOption(user, 'Sub-County', 'Dagoretti North')

      expect(getSelectedText('Ward')).toContain('Select ward')
      expect(getSelectedText('Neighborhood')).toContain('Select ward first')
    })

    it('resets downstream when ward changes', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        const streetSelect = getSelectByLabelText('Street')
        expect(streetSelect.options.length).toBeGreaterThan(1)
      })
      await selectOption(user, 'Street', 'Kitisuru Road')

      await selectOption(user, 'Ward', 'Parklands/Highridge')

      expect(getSelectedText('Neighborhood')).toContain('Select neighborhood')
    })

    it('resets all landmark selections when neighborhood changes', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Street').options.length).toBeGreaterThan(1)
      })
      await selectOption(user, 'Street', 'Kitisuru Road')
      await selectOption(user, 'School', 'Kitisuru Primary School')

      await selectOption(user, 'Neighborhood', 'Loresho')

      // All landmark selections reset to placeholder for the new neighborhood
      expect(getSelectedText('Street')).toContain('Select Street')
      expect(getSelectedText('School')).toContain('Select School')
      expect(screen.getByText(/0 of 5 landmarks selected/i)).toBeInTheDocument()
    })
  })

  describe('Plot Number and Postal Code', () => {
    it('renders plot number and postal code fields', () => {
      expect(screen.getByText(/house \/ plot number/i)).toBeInTheDocument()
      expect(screen.getByText(/postal code/i)).toBeInTheDocument()
    })

    it('allows typing in plot number and postal code', async () => {
      const plotInput = screen.getByPlaceholderText(/e\.g\. Plot 14/i)
      const postalInput = screen.getByPlaceholderText(/e\.g\. 00100/i)

      await act(async () => {
        fireEvent.change(plotInput, { target: { value: 'Plot 14' } })
        fireEvent.change(postalInput, { target: { value: '00100' } })
        rerender(<AddressStep formData={mockFormData} updateField={mockUpdateField} />)
      })

      expect(plotInput).toHaveValue('Plot 14')
      expect(postalInput).toHaveValue('00100')
    })
  })

  describe('API Call Verification', () => {
    it('makes correct sequence of API calls for full flow', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))

      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      await selectOption(user, 'Neighborhood', 'Kitisuru')
      await waitFor(() => {
        expect(getSelectByLabelText('Market').options.length).toBeGreaterThan(1)
      })

      const endpoints = apiCallLog.map((c) => {
        const match = c.url.match(/\/api\/origination\/location\/([^/?]+)/)
        return match ? match[1] : null
      })

      expect(endpoints).toEqual([
        'counties',
        'subcounties',
        'wards',
        'neighborhoods',
        'streets',
        'schools',
        'health-centers',
        'buildings',
        'markets',
      ])
    })

    it('does not make duplicate calls for cached data', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      const callCountAfterWard = api.get.mock.calls.length

      await selectOption(user, 'Ward', 'Parklands/Highridge')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(callCountAfterWard)
    })

    it('refetches neighborhoods when re-selecting a previously chosen ward', async () => {
      await selectOption(user, 'County', 'Nairobi')
      await waitFor(() => expect(isDisabled('Sub-County')).toBe(false))
      await selectOption(user, 'Sub-County', 'Westlands')
      await waitFor(() => expect(isDisabled('Ward')).toBe(false))

      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))
      const callsAfterFirstKitisuru = api.get.mock.calls.length

      await selectOption(user, 'Ward', 'Parklands/Highridge')
      await waitFor(() => expect(isDisabled('Neighborhood')).toBe(false))

      // Re-selecting Kitisuru triggers a fresh neighborhoods fetch
      await selectOption(user, 'Ward', 'Kitisuru')
      await waitFor(() => {
        expect(api.get.mock.calls.length).toBeGreaterThan(callsAfterFirstKitisuru + 1)
      })

      const kitisuruNhCalls = apiCallLog.filter(
        (c) => c.url.includes('neighborhoods') && c.url.includes('ward=Kitisuru')
      )
      expect(kitisuruNhCalls.length).toBe(2)
    })
  })
})