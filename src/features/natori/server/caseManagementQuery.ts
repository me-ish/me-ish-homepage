import "server-only";
import { PROJECT_RELATIONS } from "./caseSnapshotAdapter";
import { FINANCIAL_RELATIONS } from "./caseSnapshotFinancial";
import { LIFECYCLE_RELATIONS } from "./caseSnapshotLifecycle";
import { CASE_SOURCE_LIMIT } from "./caseSnapshotSource";

const relations = [...PROJECT_RELATIONS, ...FINANCIAL_RELATIONS, ...LIFECYCLE_RELATIONS];
export const CASE_MANAGEMENT_SECTIONS: readonly string[] = Object.freeze(relations.map(r => r.name));

// Relation names and SELECT fragments are authored constants, never request data.
if (new Set(CASE_MANAGEMENT_SECTIONS).size !== relations.length
  || relations.some(r => !/^[a-z_]+$/.test(r.name))) {
  throw new Error("Invalid case reader relation definitions");
}

/**
 * One statement gives every selected fact the same PostgreSQL MVCC snapshot.
 * Each relation supplies an exact count plus bounded rows in that statement.
 * The non-production app transport uses a fixed read-contract RPC. There is no
 * arbitrary SQL endpoint or fallback fan-out that mixes snapshots.
 */
export const CASE_MANAGEMENT_SQL = `WITH authorized_case AS MATERIALIZED (
  SELECT p.id, p.user_id, p.title, p.client_name, p.due_date, p.status, p.type, p.amount, p.active_quote_id,
    p.quote_accepted_at, p.quote_accepted_amount, p.payment_confirmed_at,
    p.paid_amount, p.paid_at, p.delivery_accepted_at, p.completed_at,
    p.delivered_mail_at, p.payment_link_id, p.payment_link_url, p.payment_link_status, p.payment_quote_id,
    p.stripe_payment_session_id, p.deleted_at, p.created_at, p.updated_at
  FROM public.natori_projects p
  WHERE p.id = $1::uuid AND p.user_id = $2::uuid
), ${relations.map(r => `${r.name}_rows AS MATERIALIZED (${r.select})`).join(",\n")}
SELECT md5(pg_current_snapshot()::text || '/' || statement_timestamp()::text) AS snapshot_id,
  (to_jsonb(statement_timestamp()) #>> '{}') AS observed_at,
  jsonb_build_object(
    'id', p.id, 'user_id', p.user_id, 'title', p.title, 'client_name', p.client_name, 'due_date', p.due_date,
    'status', p.status, 'type', p.type, 'amount', p.amount,
    'active_quote_id', p.active_quote_id, 'quote_accepted_at', p.quote_accepted_at,
    'quote_accepted_amount', p.quote_accepted_amount, 'payment_confirmed_at', p.payment_confirmed_at,
    'paid_amount', p.paid_amount, 'paid_at', p.paid_at, 'delivery_accepted_at', p.delivery_accepted_at,
    'completed_at', p.completed_at, 'delivered_mail_at', p.delivered_mail_at,
    'has_legacy_payment_link', (p.payment_link_id IS NOT NULL OR p.payment_link_url IS NOT NULL),
    'payment_link_status', p.payment_link_status, 'deleted_at', p.deleted_at,
    'created_at', p.created_at, 'updated_at', p.updated_at
  ) AS project,
  jsonb_build_object(${relations.map(r => `
    '${r.name}', jsonb_build_object(
      'total', (SELECT count(*) FROM ${r.name}_rows),
      'rows', COALESCE((SELECT jsonb_agg(bounded ORDER BY bounded.id)
        FROM (SELECT * FROM ${r.name}_rows ORDER BY id LIMIT ${CASE_SOURCE_LIMIT + 1}) bounded), '[]'::jsonb)
    )`).join(",")}
  ) AS sections
FROM authorized_case p`;
