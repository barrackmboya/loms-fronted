// Address step — step 4 of the loan application form.
// Cascading location dropdowns (County → Sub-County → Ward → Neighborhood)
// backed by Django location API endpoints, plus landmark selectors
// (Street / School / Health Center / Building / Market).
//
// After a Neighborhood is selected, the user may pick ONE option per landmark
// type — up to all five. At least 3 selections are required to proceed.
// Any change in a parent selection always triggers a fresh reload of the
// child options (no stale cache) and clears all downstream selections.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../../lib/api'

const LOCATION_BASE = '/api/origination/location'

const LANDMARK_TYPES = [
  { key: 'street', label: 'Street', endpoint: 'streets', category: 'streets' },
  { key: 'school', label: 'School', endpoint: 'schools', category: 'schools' },
  { key: 'health_center', label: 'Health Center', endpoint: 'health-centers', category: 'healthCenters' },
  { key: 'building', label: 'Building', endpoint: 'buildings', category: 'buildings' },
  { key: 'market', label: 'Market', endpoint: 'markets', category: 'markets' },
]

const MIN_LANDMARK_SELECTIONS = 3

const INITIAL_ADDRESS = {
  county: null,
  subcounty: null,
  ward: null,
  neighborhood: null,
  street: null,
  landmark: null,
  landmarks: [],
  lat: null,
  lng: null,
  plot_number: '',
  postal_code: '',
}

async function fetchOptions(endpoint, params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, v)
  })
  const url = `${LOCATION_BASE}/${endpoint}/${search.toString() ? `?${search.toString()}` : ''}`
  const res = await api.get(url)

  if (Array.isArray(res)) return res
  if (Array.isArray(res?.data?.data)) return res.data.data
  if (Array.isArray(res?.data)) return res.data
  return []
}

export function AddressStep({ formData, updateField }) {
  const address = { ...INITIAL_ADDRESS, ...formData.address }

  const [loading, setLoading] = useState({
    counties: false,
    subcounties: false,
    wards: false,
    neighborhoods: false,
    streets: false,
    schools: false,
    healthCenters: false,
    buildings: false,
    markets: false,
  })
  const [error, setError] = useState({})

  const [options, setOptions] = useState({
    counties: [],
    subcounties: [],
    wards: [],
    neighborhoods: [],
    streets: [],
    schools: [],
    healthCenters: [],
    buildings: [],
    markets: [],
  })

  // Request sequence guards: a response is only applied if it is still the
  // latest request for its category. Prevents a slow earlier response from
  // overwriting fresher options after a rapid parent change.
  const seqRef = useRef({})
  const bumpSeq = (category) => {
    seqRef.current[category] = (seqRef.current[category] || 0) + 1
    return seqRef.current[category]
  }
  const isCurrent = (category, reqId) => seqRef.current[category] === reqId

  // Clears a category's options and invalidates any in-flight request.
  const clearCategory = useCallback((category) => {
    bumpSeq(category)
    setOptions((prev) => ({ ...prev, [category]: [] }))
    setLoading((prev) => ({ ...prev, [category]: false }))
    setError((prev) => ({ ...prev, [category]: null }))
  }, [])

  const fetchCategory = useCallback(async (category, endpoint, params) => {
    const reqId = bumpSeq(category)
    setLoading((prev) => ({ ...prev, [category]: true }))
    setError((prev) => ({ ...prev, [category]: null }))
    try {
      const data = await fetchOptions(endpoint, params)
      if (!isCurrent(category, reqId)) return
      setOptions((prev) => ({ ...prev, [category]: data }))
    } catch (err) {
      if (!isCurrent(category, reqId)) return
      setError((prev) => ({ ...prev, [category]: err.message || `Failed to load ${category}` }))
    } finally {
      if (isCurrent(category, reqId)) {
        setLoading((prev) => ({ ...prev, [category]: false }))
      }
    }
  }, [])

  // ---------- Loaders (each call always hits the API — fresh options) ----------

  const loadCounties = useCallback(async () => {
    const reqId = bumpSeq('counties')
    setLoading((prev) => ({ ...prev, counties: true }))
    setError((prev) => ({ ...prev, counties: null }))
    try {
      const data = await fetchOptions('counties', {})
      if (!isCurrent('counties', reqId)) return
      setOptions((prev) => ({ ...prev, counties: data }))
      if (data.length) {
        updateField('address', (addr) => {
          if (!addr.county) return { ...addr, county: data[0] }
          return addr
        })
      }
    } catch (err) {
      if (!isCurrent('counties', reqId)) return
      setError((prev) => ({ ...prev, counties: err.message || 'Failed to load counties' }))
    } finally {
      if (isCurrent('counties', reqId)) {
        setLoading((prev) => ({ ...prev, counties: false }))
      }
    }
  }, [updateField])

  const loadSubCounties = useCallback(
    (county) => {
      if (!county) {
        clearCategory('subcounties')
        return
      }
      return fetchCategory('subcounties', 'subcounties', { county: county.name })
    },
    [fetchCategory, clearCategory]
  )

  const loadWards = useCallback(
    (county, subcounty) => {
      if (!county || !subcounty) {
        clearCategory('wards')
        return
      }
      return fetchCategory('wards', 'wards', { county: county.name, subcounty: subcounty.name })
    },
    [fetchCategory, clearCategory]
  )

  const loadNeighborhoods = useCallback(
    (county, subcounty, ward) => {
      if (!county || !subcounty || !ward) {
        clearCategory('neighborhoods')
        return
      }
      return fetchCategory('neighborhoods', 'neighborhoods', {
        county: county.name,
        subcounty: subcounty.name,
        ward: ward.name,
      })
    },
    [fetchCategory, clearCategory]
  )

  const loadLandmarkType = useCallback(
    (typeCfg, county, subcounty, ward, neighborhood) => {
      if (!neighborhood || !county || !subcounty || !ward) {
        clearCategory(typeCfg.category)
        return
      }
      return fetchCategory(typeCfg.category, typeCfg.endpoint, {
        county: county.name,
        subcounty: subcounty.name,
        ward: ward.name,
      })
    },
    [fetchCategory, clearCategory]
  )

  // ---------- React to parent changes: fresh reload of child options ----------

  useEffect(() => {
    loadCounties()
  }, [loadCounties])

  useEffect(() => {
    loadSubCounties(address.county)
  }, [address.county?.id, address.county?.name, loadSubCounties])

  useEffect(() => {
    loadWards(address.county, address.subcounty)
  }, [address.county?.id, address.subcounty?.id, address.subcounty?.name, loadWards])

  useEffect(() => {
    loadNeighborhoods(address.county, address.subcounty, address.ward)
  }, [address.county?.id, address.subcounty?.id, address.ward?.id, address.ward?.name, loadNeighborhoods])

  // The neighborhoods endpoint returns id-less options ({ name } only, from
  // raw OSM data), so the change key must fall back to the name — otherwise
  // the landmark effect never re-runs when a neighborhood is selected.
  const neighborhoodKey =
    address.neighborhood?.id ?? address.neighborhood?.osm_id ?? address.neighborhood?.name

  useEffect(() => {
    LANDMARK_TYPES.forEach((typeCfg) => {
      loadLandmarkType(
        typeCfg,
        address.county,
        address.subcounty,
        address.ward,
        address.neighborhood
      )
    })
  }, [
    neighborhoodKey,
    address.county?.name,
    address.subcounty?.name,
    address.ward?.name,
    loadLandmarkType,
  ])

  // ---------- Validation ----------

  const landmarkSelections = (address.landmarks || []).filter((l) => l.type !== 'street')
  const selectedCount = (address.street ? 1 : 0) + landmarkSelections.length
  const landmarksValid = selectedCount >= MIN_LANDMARK_SELECTIONS

  const isValid =
    !!address.county &&
    !!address.subcounty &&
    !!address.ward &&
    !!address.neighborhood &&
    landmarksValid

  // ---------- Handlers ----------

  const handleSelect = (field, option) => {
    updateField('address', (prev) => {
      const next = { ...prev, [field]: option }
      if (field === 'county') {
        next.subcounty = null
        next.ward = null
        next.neighborhood = null
        next.street = null
        next.landmark = null
        next.landmarks = []
      } else if (field === 'subcounty') {
        next.ward = null
        next.neighborhood = null
        next.street = null
        next.landmark = null
        next.landmarks = []
      } else if (field === 'ward') {
        next.neighborhood = null
        next.street = null
        next.landmark = null
        next.landmarks = []
      } else if (field === 'neighborhood') {
        next.street = null
        next.landmark = null
        next.landmarks = []
      }
      return next
    })
  }

  const handleLandmarkSelect = (type, option) => {
    updateField('address', (prev) => {
      if (type === 'street') {
        return { ...prev, street: option }
      }
      const others = (prev.landmarks || []).filter((l) => l.type !== type)
      return {
        ...prev,
        landmark: null,
        landmarks: option ? [...others, { type, id: option.id, name: option.name }] : others,
      }
    })
  }

  const handleText = (field) => (e) => {
    updateField('address', (prev) => ({ ...prev, [field]: e.target.value }))
  }

  // ---------- Render helpers ----------

  const renderSelect = ({ label, value, options: opts, onChange, placeholder, isLoading, err, disabled, onRetry }) => {
    const showSpinner = isLoading && !opts.length

    // Find the selected option's index by matching id/osm_id, falling back to
    // name match (landmark options from OSM have no id), then reference
    // equality. Guard against value having no id/osm_id so we don't
    // accidentally match undefined === undefined against the first option.
    let selectedIndex = -1
    if (value) {
      const valueId = value.id ?? value.osm_id
      if (valueId != null) {
        selectedIndex = opts.findIndex((o) => (o.id ?? o.osm_id) === valueId)
      }
      if (selectedIndex < 0 && value.name != null && value.name !== '') {
        selectedIndex = opts.findIndex((o) => o.name === value.name)
      }
      if (selectedIndex < 0) {
        selectedIndex = opts.indexOf(value)
      }
    }
    const currentValue = selectedIndex >= 0 ? String(selectedIndex) : ''

    return (
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
        <select
          value={currentValue !== '-1' ? currentValue : ''}
          onChange={(e) => {
            const val = e.target.value
            if (val === '') {
              onChange(null)
              return
            }
            const idx = parseInt(val, 10)
            onChange(opts[idx] || null)
          }}
          disabled={disabled}
          className="w-full min-w-0 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          {showSpinner && (
            <option disabled value="">Loading…</option>
          )}
          {!value && !showSpinner && (
            <option disabled value="">{placeholder}</option>
          )}
          {opts.map((o, i) => (
            <option key={o.id ?? o.osm_id ?? `idx-${i}`} value={i}>
              {o.name}
            </option>
          ))}
        </select>
        {err && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <span>⚠</span>
            {err.includes('Failed to load') && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="underline text-destructive hover:text-destructive/80"
              >
                Retry
              </button>
            ) : (
              <span>{err}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderLandmarkSelect = (typeCfg) => {
    const category = typeCfg.category
    const value =
      typeCfg.key === 'street'
        ? address.street
        : landmarkSelections.find((l) => l.type === typeCfg.key) || null
    return renderSelect({
      label: typeCfg.label,
      value,
      options: options[category],
      onChange: (o) => handleLandmarkSelect(typeCfg.key, o),
      placeholder: `Select ${typeCfg.label}`,
      isLoading: loading[category],
      err: error[category],
      onRetry: () =>
        loadLandmarkType(
          typeCfg,
          address.county,
          address.subcounty,
          address.ward,
          address.neighborhood
        ),
    })
  }

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
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
              err: error.counties,
              onRetry: loadCounties,
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
              onRetry: () => loadSubCounties(address.county),
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
              onRetry: () => loadWards(address.county, address.subcounty),
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
              onRetry: () => loadNeighborhoods(address.county, address.subcounty, address.ward),
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Landmarks <span className="text-muted-foreground font-normal">(select at least {MIN_LANDMARK_SELECTIONS} — one per type)</span>
          </label>
          {address.neighborhood ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              {LANDMARK_TYPES.map((typeCfg) => (
                <div key={typeCfg.key}>
                  {renderLandmarkSelect(typeCfg)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
              Select a neighborhood to choose landmarks.
            </p>
          )}
          {address.neighborhood && (
            <div
              className={`mt-3 p-2 rounded-lg border ${
                landmarksValid
                  ? 'border-teal-500/20 bg-teal-50/5'
                  : 'border-destructive/20 bg-destructive/5'
              }`}
            >
              <p className={`text-xs ${landmarksValid ? 'text-teal-700' : 'text-destructive'}`}>
                {landmarksValid
                  ? `${selectedCount} of ${LANDMARK_TYPES.length} landmarks selected.`
                  : `${selectedCount} of ${LANDMARK_TYPES.length} landmarks selected — at least ${MIN_LANDMARK_SELECTIONS} are required.`}
              </p>
            </div>
          )}
        </div>
      </div>

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

      {!isValid && (
        <div className="p-2 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive">
          Please select County, Sub-County, Ward, Neighborhood, and at least {MIN_LANDMARK_SELECTIONS} landmarks (e.g. Street, School, Market).
        </div>
      )}
    </div>
  )
}
