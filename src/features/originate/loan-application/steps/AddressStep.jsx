// Address step — step 4 of the loan application form.
// Cascading location dropdowns (County → Sub-County → Ward → Neighborhood)
// backed by Django location API endpoints, plus a landmark selector.
//
// Form data is stored under formData.address:
// {
//   county: { id, name } | null,
//   subcounty: { id, name } | null,
//   ward: { id, name } | null,
//   neighborhood: { id, name } | null,
//   street: { id, name } | null,
//   landmark: { type, id, name } | null,
//   lat: number | null,
//   lng: number | null,
//   plot_number: string,
//   postal_code: string
// }

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../../lib/api'

const LOCATION_BASE = '/api/origination/location'

const LANDMARK_TYPES = [
  { key: 'street', label: 'Street', endpoint: 'streets' },
  { key: 'school', label: 'School', endpoint: 'schools' },
  { key: 'health_center', label: 'Health Center', endpoint: 'health-centers' },
  { key: 'building', label: 'Building', endpoint: 'buildings' },
  { key: 'market', label: 'Market', endpoint: 'markets' },
]

const INITIAL_ADDRESS = {
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
}

// Fetch a dropdown list and return the `data` array.
async function fetchOptions(endpoint, params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, v)
  })
  const url = `${LOCATION_BASE}/${endpoint}/${search.toString() ? `?${search.toString()}` : ''}`
  const response = await api.get(url)
  return Array.isArray(response.data) ? response.data : []
}

export function AddressStep({ formData, updateField }) {
  const address = formData.address ?? INITIAL_ADDRESS

  // Per-endpoint loading / error state
  const [loading, setLoading] = useState({ counties: false })
  const [error, setError] = useState({})

  // Cached option lists, keyed by the parent id used to fetch them
  const cacheRef = useRef({
    counties: null,
    subcounties: {},
    wards: {},
    neighborhoods: {},
    streets: {},
    schools: {},
    healthCenters: {},
    buildings: {},
    markets: {},
  })

  const [options, setOptions] = useState({
    counties: [],
    subcounties: [],
    wards: [],
    neighborhoods: [],
    landmarks: [],
  })

  const landmarkTypeRef = useRef(address.landmark?.type ?? 'street')

  // ---------- County: load on mount ----------

  useEffect(() => {
    let cancelled = false
    setLoading((prev) => ({ ...prev, counties: true }))
    setError((prev) => ({ ...prev, counties: null }))

    fetchOptions('counties')
      .then((data) => {
        if (!cancelled) {
          setOptions((prev) => ({ ...prev, counties: data }))
          cacheRef.current.counties = data
          if (data.length && !address.county) {
            updateField('address', { ...address, county: data[0] })
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError((prev) => ({ ...prev, counties: err.message || 'Failed to load counties' }))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading((prev) => ({ ...prev, counties: false }))
      })

    return () => { cancelled = true }
  }, [])

  // ---------- Derived fetch triggers ----------

  const fetchSubCounties = useCallback(async (county) => {
    if (!county) {
      setOptions((prev) => ({ ...prev, subcounties: [] }))
      updateField('address', { ...address, subcounty: null, ward: null, neighborhood: null, street: null, landmark: null })
      return
    }
    const key = county.id ?? county
    if (cacheRef.current.subcounties[key]) {
      setOptions((prev) => ({ ...prev, subcounties: cacheRef.current.subcounties[key] }))
      return
    }
    setLoading((prev) => ({ ...prev, subcounties: true }))
    setError((prev) => ({ ...prev, subcounties: null }))
    try {
      const data = await fetchOptions('subcounties', { county: key })
      cacheRef.current.subcounties[key] = data
      setOptions((prev) => ({ ...prev, subcounties: data }))
      updateField('address', { ...address, subcounty: data.length ? data[0] : null, ward: null, neighborhood: null, street: null, landmark: null })
    } catch (err) {
      setError((prev) => ({ ...prev, subcounties: err.message || 'Failed to load sub-counties' }))
    } finally {
      setLoading((prev) => ({ ...prev, subcounties: false }))
    }
  }, [address])

  const fetchWards = useCallback(async (county, subcounty) => {
    if (!county || !subcounty) {
      setOptions((prev) => ({ ...prev, wards: [] }))
      updateField('address', { ...address, ward: null, neighborhood: null, street: null, landmark: null })
      return
    }
    const key = `${county.id ?? county}-${subcounty.id ?? subcounty}`
    if (cacheRef.current.wards[key]) {
      setOptions((prev) => ({ ...prev, wards: cacheRef.current.wards[key] }))
      return
    }
    setLoading((prev) => ({ ...prev, wards: true }))
    setError((prev) => ({ ...prev, wards: null }))
    try {
      const data = await fetchOptions('wards', { county: county.id ?? county, subcounty: subcounty.id ?? subcounty })
      cacheRef.current.wards[key] = data
      setOptions((prev) => ({ ...prev, wards: data }))
      updateField('address', { ...address, ward: data.length ? data[0] : null, neighborhood: null, street: null, landmark: null })
    } catch (err) {
      setError((prev) => ({ ...prev, wards: err.message || 'Failed to load wards' }))
    } finally {
      setLoading((prev) => ({ ...prev, wards: false }))
    }
  }, [address])

  const fetchNeighborhoods = useCallback(async (county, subcounty, ward) => {
    if (!county || !subcounty || !ward) {
      setOptions((prev) => ({ ...prev, neighborhoods: [] }))
      updateField('address', { ...address, neighborhood: null, street: null, landmark: null })
      return
    }
    const key = `${county.id ?? county}-${subcounty.id ?? subcounty}-${ward.id ?? ward}`
    if (cacheRef.current.neighborhoods[key]) {
      setOptions((prev) => ({ ...prev, neighborhoods: cacheRef.current.neighborhoods[key] }))
      return
    }
    setLoading((prev) => ({ ...prev, neighborhoods: true }))
    setError((prev) => ({ ...prev, neighborhoods: null }))
    try {
      const data = await fetchOptions('neighborhoods', {
        county: county.id ?? county,
        subcounty: subcounty.id ?? subcounty,
        ward: ward.id ?? ward,
      })
      cacheRef.current.neighborhoods[key] = data
      setOptions((prev) => ({ ...prev, neighborhoods: data }))
      updateField('address', { ...address, neighborhood: data.length ? data[0] : null, street: null, landmark: null })
    } catch (err) {
      setError((prev) => ({ ...prev, neighborhoods: err.message || 'Failed to load neighborhoods' }))
    } finally {
      setLoading((prev) => ({ ...prev, neighborhoods: false }))
    }
  }, [address])

  const fetchLandmarks = useCallback(async (neighborhood, type) => {
    if (!neighborhood) {
      setOptions((prev) => ({ ...prev, landmarks: [] }))
      return
    }
    if (!address.county || !address.subcounty || !address.ward) {
      setOptions((prev) => ({ ...prev, landmarks: [] }))
      return
    }
    const typeCfg = LANDMARK_TYPES.find((t) => t.key === type)
    if (!typeCfg) return
    const key = `${neighborhood.id ?? neighborhood}-${type}`
    const cacheKey = type === 'street' ? 'streets' : type === 'school' ? 'schools' : type === 'health_center' ? 'healthCenters' : type === 'building' ? 'buildings' : 'markets'
    if (cacheRef.current[cacheKey][key]) {
      setOptions((prev) => ({ ...prev, landmarks: cacheRef.current[cacheKey][key] }))
      return
    }
    setLoading((prev) => ({ ...prev, [cacheKey]: true }))
    setError((prev) => ({ ...prev, [cacheKey]: null }))
    try {
      const data = await fetchOptions(typeCfg.endpoint, {
        county: address.county.name,
        subcounty: address.subcounty.name,
        ward: address.ward.name,
      })
      cacheRef.current[cacheKey][key] = data
      setOptions((prev) => ({ ...prev, landmarks: data }))
    } catch (err) {
      setError((prev) => ({ ...prev, [cacheKey]: err.message || `Failed to load ${typeCfg.label}s` }))
    } finally {
      setLoading((prev) => ({ ...prev, [cacheKey]: false }))
    }
  }, [address])

  // ---------- React to upstream changes ----------

  useEffect(() => {
    fetchSubCounties(address.county)
  }, [address.county, fetchSubCounties])

  useEffect(() => {
    fetchWards(address.county, address.subcounty)
  }, [address.subcounty, fetchWards])

  useEffect(() => {
    fetchNeighborhoods(address.county, address.subcounty, address.ward)
  }, [address.ward, fetchNeighborhoods])

  useEffect(() => {
    if (address.neighborhood) {
      fetchLandmarks(address.neighborhood, landmarkTypeRef.current)
    } else {
      setOptions((prev) => ({ ...prev, landmarks: [] }))
    }
  }, [address.neighborhood, fetchLandmarks])

  // ---------- Validation ----------

  const isValid =
    !!address.county &&
    !!address.subcounty &&
    !!address.ward &&
    !!address.neighborhood &&
    (!!address.street || !!address.landmark)

  // ---------- Handlers ----------

  const handleSelect = (field, option) => (e) => {
    const next = { ...address, [field]: option }
    updateField('address', next)
  }

  const handleLandmarkTypeChange = (type) => {
    landmarkTypeRef.current = type
    const next = { ...address, landmark: null }
    updateField('address', next)
    if (address.neighborhood) {
      fetchLandmarks(address.neighborhood, type)
    }
  }

  const handleText = (field) => (e) => {
    updateField('address', { ...address, [field]: e.target.value })
  }

  const handleSelectOption = (field, option) => {
    const next = { ...address, [field]: option }
    // Reset downstream when selecting a street/landmark directly
    if (field === 'street') next.landmark = null
    if (field === 'landmark') next.street = null
    updateField('address', next)
  }

  // ---------- Render helpers ----------

  const renderSelect = ({ label, value, options: opts, onChange, placeholder, isLoading, err, disabled }) => {
    const showSpinner = isLoading && !value
    return (
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
        <select
          value={value?.id ?? value ?? ''}
          onChange={(e) => {
            const sel = opts.find((o) => String(o.id ?? o.osm_id) === e.target.value)
            onChange(sel || null)
          }}
          disabled={disabled}
          className="w-full min-w-0 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          {showSpinner && (
            <option disabled value="">Loading…</option>
          )}
          {!value && !showSpinner && (
            <option disabled value>{placeholder}</option>
          )}
          {opts.map((o) => (
            <option key={o.id ?? o.osm_id} value={o.id ?? o.osm_id}>
              {o.name}
            </option>
          ))}
        </select>
        {err && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <span>⚠</span>
            <button
              onClick={() => {}}
              className="underline text-destructive hover:text-destructive/80"
            >
              {err.includes('Failed to load') ? 'Retry' : err}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      {/* Cascading location selectors */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full">
            {renderSelect({
              label: 'County',
              value: address.county,
              options: options.counties,
              onChange: (o) => handleSelect('county', o),
              placeholder: 'Select county',
              isLoading: loading.counties,
            })}
          </div>
          <div>
            {renderSelect({
              label: 'Sub-County',
              value: address.subcounty,
              options: options.subcounties,
              onChange: (o) => handleSelect('subcounty', o),
              placeholder: address.county ? 'Select sub-county' : 'Select county first',
              isLoading: loading.subcounties,
              disabled: !address.county,
              err: error.subcounties,
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            {renderSelect({
              label: 'Ward',
              value: address.ward,
              options: options.wards,
              onChange: (o) => handleSelect('ward', o),
              placeholder: address.subcounty ? 'Select ward' : 'Select sub-county first',
              isLoading: loading.wards,
              disabled: !address.subcounty,
              err: error.wards,
            })}
          </div>
          <div>
            {renderSelect({
              label: 'Neighborhood',
              value: address.neighborhood,
              options: options.neighborhoods,
              onChange: (o) => handleSelect('neighborhood', o),
              placeholder: address.ward ? 'Select neighborhood' : 'Select ward first',
              isLoading: loading.neighborhoods,
              disabled: !address.ward,
              err: error.neighborhoods,
            })}
          </div>
        </div>
      </div>

      {/* Landmark selector */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 border border-input rounded-md bg-background p-1">
          {LANDMARK_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => handleLandmarkTypeChange(t.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                landmarkTypeRef.current === t.key
                  ? 'bg-teal-600 text-white'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {address.neighborhood && (
          <div>
            {renderSelect({
              label: `${LANDMARK_TYPES.find((t) => t.key === landmarkTypeRef.current)?.label ?? 'Landmark'}`,
              value: address.landmark,
              options: options.landmarks,
              onChange: (o) => handleSelectOption('landmark', { ...o, type: landmarkTypeRef.current }),
              placeholder: `Select ${LANDMARK_TYPES.find((t) => t.key === landmarkTypeRef.current)?.label ?? 'landmark'}`,
              isLoading: loading.streets || loading.schools || loading.healthCenters || loading.buildings || loading.markets,
              err: error.streets || error.schools || error.healthCenters || error.buildings || error.markets,
            })}
          </div>
        )}
        {!address.neighborhood && (
          <p className="text-xs text-muted-foreground">Select a neighborhood to choose a landmark.</p>
        )}
      </div>

      {/* Additional address fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">House / Plot Number</label>
          <input
            type="text"
            value={address.plot_number}
            onChange={handleText('plot_number')}
            placeholder="e.g. Plot 14"
            className="w-full min-w-0 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Postal Code</label>
          <input
            type="text"
            value={address.postal_code}
            onChange={handleText('postal_code')}
            placeholder="e.g. 00100"
            className="w-full min-w-0 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {/* Validation hint */}
      {!isValid && (
        <div className="p-2 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive">
          Please select County, Sub-County, Ward, Neighborhood, and a Street or Landmark.
        </div>
      )}
    </div>
  )
}
