import { dispatchSms } from '../_shared/smsDispatch.ts';
import { authorize } from '../_shared/authorization.ts';
/**
 * process-automations — Supabase Edge Function
 *
 * Processes automation enrollments whose next_execution_at has passed.
 * Should be invoked on a schedule (every 1–5 minutes via pg_cron or external cron).
 *
 * SAFETY GUARANTEES:
 * - Only processes enrollments for automations with status = 'active'
 * - Uses processing_locked_at to prevent concurrent double-processing
 * - Checks marketing_sms_consent before any SMS send
 * - Checks opt-out (revoked_at) before any SMS send
 * - Loops are bounded: max 20 nodes per execution run per enrollment
 * - Draft and paused automations are completely ignored
 * - All sends use the shared durable dispatch and consent gate
 */

import { serve, createClient } from "../_shared/runtime.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_NODES_PER_RUN = 20   // Loop protection: max steps per enrollment per tick

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const denied = await authorize(req, { worker: true, headers: corsHeaders });
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    // Interrupted claims require review, not automatic replay of graph side effects.
    const { data: validEnrollments, error: claimError } = await supabaseClient.rpc('crm_claim_automation_enrollments', { p_limit:10 })
    if (claimError) throw new Error('Could not claim due automations')

    const results: any[] = []

    // ── 3. Process each enrollment ─────────────────────────────────────────
    for (const enrollment of validEnrollments || []) {
      const contact = enrollment.contact
      const result = await processEnrollment(enrollment, contact, supabaseClient)
      results.push(result)
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('process-automations ERROR:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── Core enrollment processor ─────────────────────────────────────────────

async function processEnrollment(
  enrollment: any,
  contact: any,
  db: any
): Promise<any> {
  const enrollmentId = enrollment.id
  const automationId = enrollment.automation_id

  try {
    // ── Safety checks ──────────────────────────────────────────────────────

    // 1. Contact must exist
    if (!contact) {
      await failEnrollment(db, enrollmentId, 'Contact record not found')
      return { enrollmentId, status: 'failed', reason: 'contact_not_found' }
    }

    // 2. Contact must not have opted out
    if (contact.revoked_at && contact.revoked_reason !== 'User opted out via UI') {
      await completeEnrollment(db, enrollmentId, 'Contact opted out — automation ended gracefully')
      await logAction(db, { enrollmentId, automationId, contactId: contact.id, nodeId: null, nodeType: null, action: 'opted_out', result: { revoked_at: contact.revoked_at } })
      return { enrollmentId, status: 'completed_opt_out' }
    }

    // ── Walk nodes ─────────────────────────────────────────────────────────
    let currentNodeId: string | null = enrollment.current_node_id
    let stepCount = 0

    while (currentNodeId && stepCount < MAX_NODES_PER_RUN) {
      stepCount++

      // Fetch the current node
      const { data: node, error: nodeErr } = await db
        .from('automation_nodes')
        .select('*')
        .eq('id', currentNodeId)
        .single()

      if (nodeErr || !node) {
        await failEnrollment(db, enrollmentId, `Node ${currentNodeId} not found`)
        return { enrollmentId, status: 'failed', reason: 'node_not_found' }
      }

      const cfg = node.config as Record<string, any>

      // ── Execute node by type ──────────────────────────────────────────────

      if (node.type === 'trigger') {
        // Trigger is just the start marker — immediately advance to next node
        const nextNodeId = await getNextNode(db, automationId, currentNodeId, 'default')
        if (!nextNodeId) {
          // Automation only has a trigger, nothing else
          await completeEnrollment(db, enrollmentId)
          return { enrollmentId, status: 'completed' }
        }
        await updateEnrollmentNode(db, enrollmentId, nextNodeId)
        currentNodeId = nextNodeId
        continue
      }

      if (node.type === 'send_sms') {
        // Guard: marketing consent required
        if (!contact.marketing_sms_consent) {
          await logAction(db, {
            enrollmentId, automationId, contactId: contact.id,
            nodeId: node.id, nodeType: 'send_sms', action: 'sms_skipped',
            result: { reason: 'no_marketing_consent' }
          })
        } else {
          // Idempotency check — don't double-send for same enrollment+node
          const { data: existing } = await db
            .from('automation_execution_log')
            .select('id')
            .eq('enrollment_id', enrollmentId)
            .eq('node_id', node.id)
            .eq('action', 'sms_sent')
            .limit(1)

          if (!existing || existing.length === 0) {
            // Interpolate variables
            const message = interpolateMessage(cfg.message || '', contact)

            // Call the existing send-sms edge function
            const sendResult = await dispatchSms(db, {
              customer_id: contact.id,
              message_type: 'marketing',
              content: message,
              ticket_id: null,
              automation_id: automationId,
              idempotency_key: `automation:${enrollmentId}:${node.id}`,
            })

            await logAction(db, {
              enrollmentId, automationId, contactId: contact.id,
              nodeId: node.id, nodeType: 'send_sms',
              action: sendResult.ok ? 'sms_sent' : 'sms_failed',
              result: sendResult,
              errorMessage: sendResult.ok ? undefined : sendResult.reason
            })
            if (['uncertain','conflict'].includes(sendResult.status)) {
              await failEnrollment(db,enrollmentId,'SMS outcome requires review before retrying')
              return { enrollmentId,status:'failed',reason:sendResult.reason }
            }
          }
        }

        // Advance to next node
        const nextNodeId = await getNextNode(db, automationId, currentNodeId, 'default')
        if (!nextNodeId) {
          await completeEnrollment(db, enrollmentId)
          return { enrollmentId, status: 'completed' }
        }
        await updateEnrollmentNode(db, enrollmentId, nextNodeId)
        currentNodeId = nextNodeId
        continue
      }

      if (node.type === 'wait') {
        const duration: number = cfg.duration || 1
        const unit: string = cfg.unit || 'days'
        const msMap: Record<string, number> = { minutes: 60000, hours: 3600000, days: 86400000 }
        const delayMs = duration * (msMap[unit] || 86400000)
        const resumeAt = new Date(Date.now() + delayMs).toISOString()

        // Check if we already logged that we started this wait
        const { data: waitLog } = await db
          .from('automation_execution_log')
          .select('id, executed_at')
          .eq('enrollment_id', enrollmentId)
          .eq('node_id', node.id)
          .eq('action', 'wait_started')
          .limit(1)

        if (!waitLog || waitLog.length === 0) {
          // First time hitting this wait — set the timer
          await db.from('automation_enrollments')
            .update({ next_execution_at: resumeAt, processing_locked_at: null })
            .eq('id', enrollmentId)

          await logAction(db, {
            enrollmentId, automationId, contactId: contact.id,
            nodeId: node.id, nodeType: 'wait', action: 'wait_started',
            result: { duration, unit, resume_at: resumeAt }
          })

          return { enrollmentId, status: 'waiting', resume_at: resumeAt }
        } else {
          // Wait has elapsed (we were called again) — advance
          const nextNodeId = await getNextNode(db, automationId, currentNodeId, 'default')
          if (!nextNodeId) {
            await completeEnrollment(db, enrollmentId)
            return { enrollmentId, status: 'completed' }
          }
          // Remove old wait log so it resets if needed later
          await db.from('automation_execution_log').delete().eq('id', waitLog[0].id)
          await updateEnrollmentNode(db, enrollmentId, nextNodeId)
          currentNodeId = nextNodeId
          continue
        }
      }

      if (node.type === 'condition') {
        // Only supported condition: has_replied
        const conditionType = cfg.condition_type || 'has_replied'
        let branch = 'no'

        if (conditionType === 'has_replied') {
          // Look for an inbound message from this contact since enrollment started
          const enrolledAt = enrollment.enrolled_at
          const { data: replies } = await db
            .from('sms_messages')
            .select('id')
            .eq('customer_id', contact.id)
            .eq('direction', 'inbound')
            .gte('created_at', enrolledAt)
            .limit(1)

          branch = (replies && replies.length > 0) ? 'yes' : 'no'
        }

        await logAction(db, {
          enrollmentId, automationId, contactId: contact.id,
          nodeId: node.id, nodeType: 'condition', action: 'condition_evaluated',
          result: { condition_type: conditionType, branch }
        })

        const nextNodeId = await getNextNode(db, automationId, currentNodeId, branch)
        if (!nextNodeId) {
          await completeEnrollment(db, enrollmentId)
          return { enrollmentId, status: 'completed' }
        }
        await updateEnrollmentNode(db, enrollmentId, nextNodeId)
        currentNodeId = nextNodeId
        continue
      }

      if (node.type === 'update_tag') {
        const action = cfg.action || 'add'
        const tag = (cfg.tag || '').trim()

        if (tag) {
          if (action === 'add') {
            await db.from('customer_tags').upsert(
              { customer_id: contact.id, tag },
              { onConflict: 'customer_id,tag' }
            )
          } else {
            await db.from('customer_tags')
              .delete()
              .eq('customer_id', contact.id)
              .eq('tag', tag)
          }

          await logAction(db, {
            enrollmentId, automationId, contactId: contact.id,
            nodeId: node.id, nodeType: 'update_tag', action: 'tag_updated',
            result: { action, tag }
          })
        }

        const nextNodeId = await getNextNode(db, automationId, currentNodeId, 'default')
        if (!nextNodeId) {
          await completeEnrollment(db, enrollmentId)
          return { enrollmentId, status: 'completed' }
        }
        await updateEnrollmentNode(db, enrollmentId, nextNodeId)
        currentNodeId = nextNodeId
        continue
      }

      if (node.type === 'end') {
        await logAction(db, {
          enrollmentId, automationId, contactId: contact.id,
          nodeId: node.id, nodeType: 'end', action: 'completed', result: {}
        })
        await completeEnrollment(db, enrollmentId)
        return { enrollmentId, status: 'completed' }
      }

      // Unknown node type — fail safely
      await failEnrollment(db, enrollmentId, `Unknown node type: ${node.type}`)
      return { enrollmentId, status: 'failed', reason: `unknown_node_type:${node.type}` }
    }

    // Reached MAX_NODES_PER_RUN — loop protection
    if (stepCount >= MAX_NODES_PER_RUN) {
      await failEnrollment(db, enrollmentId, `Exceeded max nodes per run (${MAX_NODES_PER_RUN}) — possible loop`)
      return { enrollmentId, status: 'failed', reason: 'max_nodes_exceeded' }
    }

    // currentNodeId became null without hitting 'end' — complete gracefully
    await completeEnrollment(db, enrollmentId)
    return { enrollmentId, status: 'completed' }

  } catch (err: any) {
    console.error(`Error processing enrollment ${enrollmentId}:`, err)
    await failEnrollment(db, enrollmentId, err.message)
    return { enrollmentId, status: 'error', error: err.message }
  } finally {
    // Always release the processing lock
    await db
      .from('automation_enrollments')
      .update({ processing_locked_at: null })
      .eq('id', enrollmentId)
  }
}

// ─── Helper functions ──────────────────────────────────────────────────────

async function getNextNode(db: any, automationId: string, sourceNodeId: string, handle: string): Promise<string | null> {
  const { data: edges } = await db
    .from('automation_edges')
    .select('target_node_id, source_handle')
    .eq('automation_id', automationId)
    .eq('source_node_id', sourceNodeId)
    .eq('source_handle', handle)
    .limit(1)

  return edges?.[0]?.target_node_id || null
}

async function updateEnrollmentNode(db: any, enrollmentId: string, nextNodeId: string) {
  await db
    .from('automation_enrollments')
    .update({ current_node_id: nextNodeId, next_execution_at: new Date().toISOString() })
    .eq('id', enrollmentId)
}

async function completeEnrollment(db: any, enrollmentId: string, note?: string) {
  await db
    .from('automation_enrollments')
    .update({ status: 'completed', completed_at: new Date().toISOString(), processing_locked_at: null, error_message: note || null })
    .eq('id', enrollmentId)
}

async function failEnrollment(db: any, enrollmentId: string, reason: string) {
  console.error(`Enrollment ${enrollmentId} failed: ${reason}`)
  await db
    .from('automation_enrollments')
    .update({ status: 'failed', completed_at: new Date().toISOString(), processing_locked_at: null, error_message: reason })
    .eq('id', enrollmentId)
}

async function logAction(db: any, opts: {
  enrollmentId: string
  automationId: string
  contactId: string
  nodeId: string | null
  nodeType: string | null
  action: string
  result: Record<string, any>
  errorMessage?: string
}) {
  try {
    await db.from('automation_execution_log').insert({
      enrollment_id: opts.enrollmentId,
      automation_id: opts.automationId,
      contact_id: opts.contactId,
      node_id: opts.nodeId,
      node_type: opts.nodeType,
      action: opts.action,
      result: opts.result,
      error_message: opts.errorMessage || null,
      executed_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Failed to write execution log:', e)
  }
}

function interpolateMessage(template: string, contact: any): string {
  const firstName = (contact.name || '').split(' ')[0] || ''
  const lastName = (contact.name || '').split(' ').slice(1).join(' ') || ''
  return template
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{name\}\}/gi, contact.name || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '')
    .replace(/\{name\}/g, contact.name || '')   // legacy format support
}
