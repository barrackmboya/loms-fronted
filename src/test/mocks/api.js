// API mock for testing AddressStep component
// Mocks the `api.get` function from '../../../../lib/api'

import { vi } from 'vitest'
import {
  counties,
  subCounties,
  wards,
  neighborhoods,
  landmarks,
  getTestData,
} from '../fixtures/locations'

// Track API calls for testing
export const apiCallLog = []

// Reset call log
export function resetApiCallLog() {
  apiCallLog.length = 0
}

// Simulate network delay
const delay = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock api.get function
export const mockApiGet = vi.fn(async (url) => {
  await delay()

  // Log the call
  apiCallLog.push({ url, timestamp: Date.now() })

  const LOCATION_BASE = '/api/origination/location'

  // Parse URL to determine endpoint and params
  if (!url.startsWith(LOCATION_BASE)) {
    throw new Error(`Unexpected API URL: ${url}`)
  }

  const path = url.replace(LOCATION_BASE + '/', '')
  const [endpoint, queryString] = path.split('?')
  const params = new URLSearchParams(queryString || '')

  const county = params.get('county')
  const subcounty = params.get('subcounty')
  const ward = params.get('ward')

  // Return test data based on endpoint
  const data = getTestData(endpoint, { county, subcounty, ward })

  // Return in the format expected by fetchOptions in AddressStep:
  // - Array directly, or
  // - { data: { data: [...] } }, or
  // - { data: [...] }
  return data
})

// Mock the entire api object
export const mockApi = {
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
}

// Helper to simulate API error
export function mockApiError(endpoint, errorMessage = 'Failed to load') {
  mockApiGet.mockImplementationOnce(async (url) => {
    await delay()
    if (url.includes(endpoint)) {
      throw new Error(errorMessage)
    }
    return getTestData(endpoint.replace('/api/origination/location/', '').split('?')[0], {})
  })
}

// Helper to reset mock
export function resetApiMock() {
  mockApiGet.mockReset()
  mockApiGet.mockImplementation(async (url) => {
    await delay()
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

    return getTestData(endpoint, { county, subcounty, ward })
  })
  resetApiCallLog()
}

// Initialize default mock
resetApiMock()