-- ═══════════════════════════════════════════════════════════════════
-- LMS Gestion — Row-Level Security (RLS) policies
-- ═══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS org_select ON public.organizations;
DROP POLICY IF EXISTS org_update ON public.organizations;

DROP POLICY IF EXISTS orgsettings_select ON public.organization_settings;
DROP POLICY IF EXISTS orgsettings_modify ON public.organization_settings;

DROP POLICY IF EXISTS users_select_self ON public.users;
DROP POLICY IF EXISTS users_update_self ON public.users;

DROP POLICY IF EXISTS memberships_select ON public.memberships;
DROP POLICY IF EXISTS memberships_modify ON public.memberships;

DROP POLICY IF EXISTS invitations_all ON public.invitations;

DROP POLICY IF EXISTS agencies_select ON public.agencies;
DROP POLICY IF EXISTS agencies_modify ON public.agencies;

DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_insert ON public.clients;
DROP POLICY IF EXISTS clients_update ON public.clients;

DROP POLICY IF EXISTS contacts_select ON public.contacts;
DROP POLICY IF EXISTS contacts_modify ON public.contacts;

DROP POLICY IF EXISTS locations_select ON public.client_locations;
DROP POLICY IF EXISTS locations_modify ON public.client_locations;

DROP POLICY IF EXISTS technicians_select ON public.technicians;
DROP POLICY IF EXISTS technicians_modify ON public.technicians;

DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_modify ON public.suppliers;

DROP POLICY IF EXISTS chantier_columns_select ON public.chantier_columns;
DROP POLICY IF EXISTS chantier_columns_modify ON public.chantier_columns;

DROP POLICY IF EXISTS chantiers_select ON public.chantiers;
DROP POLICY IF EXISTS chantiers_insert ON public.chantiers;
DROP POLICY IF EXISTS chantiers_update ON public.chantiers;

DROP POLICY IF EXISTS interventions_select ON public.interventions;
DROP POLICY IF EXISTS interventions_modify ON public.interventions;

DROP POLICY IF EXISTS documents_all ON public.documents;

DROP POLICY IF EXISTS quotes_select ON public.quotes;
DROP POLICY IF EXISTS quotes_modify ON public.quotes;

DROP POLICY IF EXISTS quote_lines_all ON public.quote_lines;

DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;

DROP POLICY IF EXISTS invoice_lines_all ON public.invoice_lines;
DROP POLICY IF EXISTS payments_all ON public.payments;
DROP POLICY IF EXISTS invoice_sequences_all ON public.invoice_sequences;

DROP POLICY IF EXISTS io_select ON public.intervention_orders;
DROP POLICY IF EXISTS io_modify ON public.intervention_orders;
DROP POLICY IF EXISTS iol_all ON public.intervention_order_lines;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
DROP POLICY IF EXISTS notification_prefs_all ON public.notification_preferences;

DROP POLICY IF EXISTS activity_logs_select ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;

DROP POLICY IF EXISTS ai_imports_all ON public.ai_imports;

DROP POLICY IF EXISTS email_templates_all ON public.email_templates;

DROP POLICY IF EXISTS document_templates_select ON public.document_templates;
DROP POLICY IF EXISTS document_templates_modify ON public.document_templates;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─── Helpers ───

CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT m.role::text
    FROM public.memberships m
   WHERE m.user_id = auth.uid()
     AND m.organization_id = public.current_org_id()
     AND m.is_active = true
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_agencies() RETURNS uuid[]
  LANGUAGE sql STABLE AS $$
  SELECT m.agency_ids
    FROM public.memberships m
   WHERE m.user_id = auth.uid()
     AND m.organization_id = public.current_org_id()
     AND m.is_active = true
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_technician_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT t.id
    FROM public.technicians t
    JOIN public.memberships m ON m.id = t.membership_id
   WHERE m.user_id = auth.uid()
     AND m.organization_id = public.current_org_id()
     AND m.is_active = true
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_agency_access(target_agency_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT
    public.current_user_role() IN ('owner', 'accountant', 'viewer')
    OR (
      public.current_user_role() = 'admin'
      AND (
        public.current_user_agencies() IS NULL
        OR target_agency_id = ANY(public.current_user_agencies())
      )
    )
    OR (
      public.current_user_role() = 'technician'
      AND (
        public.current_user_agencies() IS NULL
        OR target_agency_id = ANY(public.current_user_agencies())
      )
    );
$$;

-- ───────────────────────────────────────────────────────────────────
-- Activation RLS
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- Users
-- ───────────────────────────────────────────────────────────────────

CREATE POLICY users_select_self ON public.users FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM public.memberships
       WHERE organization_id = public.current_org_id() AND is_active = true
    )
  );

CREATE POLICY users_update_self ON public.users FOR UPDATE
  USING (id = auth.uid());

-- ───────────────────────────────────────────────────────────────────
-- Trigger : auto-création user public.users depuis auth.users
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    ical_token
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    encode(extensions.gen_random_bytes(24), 'base64')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ───────────────────────────────────────────────────────────────────
-- Triggers updated_at
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I; ' ||
      'CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- Search vectors triggers
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_chantier_search() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector = to_tsvector('french',
    COALESCE(NEW.reference, '') || ' ' ||
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.supplier_reference, '') || ' ' ||
    COALESCE(NEW.tenant_name, '')
  )::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chantiers_search_trigger ON public.chantiers;

CREATE TRIGGER chantiers_search_trigger
BEFORE INSERT OR UPDATE OF reference, title, description, supplier_reference, tenant_name
ON public.chantiers
FOR EACH ROW
EXECUTE FUNCTION public.update_chantier_search();

CREATE OR REPLACE FUNCTION public.update_client_search() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector = to_tsvector('french',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.legal_name, '') || ' ' ||
    COALESCE(NEW.siret, '')
  )::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_search_trigger ON public.clients;

CREATE TRIGGER clients_search_trigger
BEFORE INSERT OR UPDATE OF name, legal_name, siret
ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_client_search();