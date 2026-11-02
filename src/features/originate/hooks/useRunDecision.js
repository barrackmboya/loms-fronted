// Run decision hook (Phase 2).
// POST /api/applications/{id}/decision
// Response: { decision_id, decision, grade, pd_12m, gates, fraud,
//   scorecard, affordability, limit_detail, pricing,
//   collection_propensity, reason_codes, model_versions, as_of_ts }

import { useCallback, useState } from 'react'
import { api } from '../../../lib/api'
import { mapDecision, decisionTone, enrichDecision } from '../lib/mappers'
import { decisionStore } from '../lib/decisionStore'
import { toast } from '../../../components/ui/sonner'

export function useRunDecision() {
  const [running, setRunning] = useState(null) // null or applicationId
  const [error, setError] = useState(null)

  const run = useCallback(async (applicationId, applicationRecord) => {
    setRunning(applicationId)
    setError(null)
    try {
      const response = await api.decide(applicationId)

      // Map the decision response
      // The response shape from POST /api/applications/{id}/decision:
      // { decision_id: <record.pk>, **result.to_dict() }
      // result.to_dict() includes: decision, gates, fraud, pd_12m, grade,
      // scorecard, affordability, limit_detail (alias of limit), pricing,
      // collection_propensity, reason_codes, model_versions
      const decisionRecord = {
        id: response.decision_id,
        application: applicationId,
        decision: response.decision,
        grade: response.grade,
        pd_12m: response.pd_12m,
        as_of_ts: new Date().toISOString(), // Not in POST response, add locally
        limit: response.limit_detail,
        approved_limit: response.limit_detail?.approved_limit,
        tenor_months: response.limit_detail?.tenor_months,
        gates: response.gates,
        fraud: response.fraud,
        scorecard: response.scorecard,
        affordability: response.affordability,
        pricing: response.pricing,
        collection_propensity: response.collection_propensity,
        reason_codes: response.reason_codes,
        model_versions: response.model_versions,
        policy_version: response.policy_version,
      }

      const mapped = mapDecision(decisionRecord)
      const enriched = enrichDecision(mapped, applicationRecord)

      // Store in the decisions store
      decisionStore.add(enriched)

      toast.success('Decision completed successfully')
      return enriched
    } catch (e) {
      const msg = e.message || 'Decision failed'
      setError(msg)
      toast.error(msg)
      throw e
    } finally {
      setRunning(null)
    }
  }, [])

  return { run, running, error }
}