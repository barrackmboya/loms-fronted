// ApplicationForm — thin presentational wrapper around the existing
// OriginateApplication form (views/OriginateApplication.jsx). Imported as-is;
// not rewritten. The onDecide prop is intentionally omitted — decisions are
// triggered only from the applications table (Phase 6).
import OriginateApplication from '../../../views/OriginateApplication'

export default function ApplicationForm({
  form, set, resetForm,
  existing, setExisting,
  parties, partySearch, setPartySearch,
  docSlots, setSlot,
  error,
}) {
  return (
    <OriginateApplication
      form={form}
      set={set}
      resetForm={resetForm}
      existing={existing}
      setExisting={setExisting}
      parties={parties}
      partySearch={partySearch}
      setPartySearch={setPartySearch}
      docSlots={docSlots}
      setSlot={setSlot}
      error={error}
      // onDecide intentionally omitted — "Run Decision" lives in the table (Phase 6)
    />
  )
}
