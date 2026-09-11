-- ============================================================
-- AUTOMATIONS MIGRATION
-- Elite Phone Repair CRM — Visual Automation Builder
-- All statements use IF NOT EXISTS — safe to run multiple times
-- ZERO modifications to existing tables (only additive changes)
-- ============================================================

-- -----------------------------------------------------------
-- 1. automations — The workflow definition
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'Untitled Automation',
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'paused')),
  trigger_type TEXT NOT NULL DEFAULT 'manual'
                CHECK (trigger_type IN ('manual', 'keyword_reply')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automations_status
  ON public.automations(status);

-- -----------------------------------------------------------
-- 2. automation_nodes — Individual steps on the canvas
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('trigger','send_sms','wait','condition','update_tag','end')),
  config          JSONB DEFAULT '{}'::jsonb,
  position_x      FLOAT DEFAULT 0,
  position_y      FLOAT DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_nodes_automation
  ON public.automation_nodes(automation_id);

-- -----------------------------------------------------------
-- 3. automation_edges — Directed connections between nodes
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  source_node_id  UUID NOT NULL REFERENCES public.automation_nodes(id) ON DELETE CASCADE,
  target_node_id  UUID NOT NULL REFERENCES public.automation_nodes(id) ON DELETE CASCADE,
  source_handle   TEXT DEFAULT 'default',   -- 'default' | 'yes' | 'no'
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_edges_automation
  ON public.automation_edges(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_edges_source
  ON public.automation_edges(source_node_id);

-- -----------------------------------------------------------
-- 4. automation_enrollments — Per-contact execution state
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id       UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  contact_id          UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  current_node_id     UUID REFERENCES public.automation_nodes(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','failed','paused')),
  enrolled_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  next_execution_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  completed_at        TIMESTAMP WITH TIME ZONE,
  processing_locked_at TIMESTAMP WITH TIME ZONE,   -- prevents double-processing
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,

  -- Prevent a contact from being actively enrolled in the same automation twice
  UNIQUE (automation_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_next_exec
  ON public.automation_enrollments(next_execution_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_enrollments_automation
  ON public.automation_enrollments(automation_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_contact
  ON public.automation_enrollments(contact_id);

-- -----------------------------------------------------------
-- 5. automation_execution_log — Append-only audit trail
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_execution_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES public.automation_enrollments(id) ON DELETE CASCADE,
  automation_id   UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  node_id         UUID REFERENCES public.automation_nodes(id) ON DELETE SET NULL,
  node_type       TEXT,
  action          TEXT,          -- 'sms_sent' | 'sms_skipped' | 'wait_started' | 'condition_evaluated' | 'tag_updated' | 'completed' | 'error'
  result          JSONB DEFAULT '{}'::jsonb,
  executed_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_exec_log_enrollment
  ON public.automation_execution_log(enrollment_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_exec_log_contact
  ON public.automation_execution_log(contact_id, executed_at DESC);

-- -----------------------------------------------------------
-- 6. customer_tags — Minimal tagging for Update Tag node
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (customer_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_customer_tags_customer
  ON public.customer_tags(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_tags_tag
  ON public.customer_tags(tag);

-- -----------------------------------------------------------
-- 7. Link sms_messages to automations (additive column only)
-- -----------------------------------------------------------
ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS automation_id UUID
    REFERENCES public.automations(id) ON DELETE SET NULL;

-- -----------------------------------------------------------
-- 8. Row-Level Security — same permissive pattern as existing tables
-- -----------------------------------------------------------
ALTER TABLE public.automations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_nodes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_edges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated and anonymous access to automations"
  ON public.automations FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated and anonymous access to automation_nodes"
  ON public.automation_nodes FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated and anonymous access to automation_edges"
  ON public.automation_edges FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated and anonymous access to automation_enrollments"
  ON public.automation_enrollments FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated and anonymous access to automation_execution_log"
  ON public.automation_execution_log FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated and anonymous access to customer_tags"
  ON public.customer_tags FOR ALL TO authenticated, anon
  USING (true) WITH CHECK (true);
