-- ==============================================================================
-- DOCUAGENT AI: Enterprise PostgreSQL Schema with Row-Level Security (RLS)
-- Migration 001: Tenants, Users, Cases, Fields, Findings, and Audit Logs
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(64) DEFAULT 'enterprise',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY DEFAULT ('usr-' || uuid_generate_v4()),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'reviewer', 'viewer', 'applicant')),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Cases Table
CREATE TABLE IF NOT EXISTS cases (
    case_id VARCHAR(64) PRIMARY KEY DEFAULT ('case-' || uuid_generate_v4()),
    case_number VARCHAR(64) UNIQUE NOT NULL,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    created_by VARCHAR(64) NOT NULL REFERENCES users(user_id),
    version INTEGER NOT NULL DEFAULT 1,
    document_type VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_kb INTEGER NOT NULL,
    file_mime VARCHAR(128) NOT NULL,
    raw_text_encrypted TEXT,
    file_data_url_encrypted TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'Ready for Review',
    assigned_queue VARCHAR(64) NOT NULL DEFAULT 'General Review',
    assigned_reviewer VARCHAR(255),
    routing_reason TEXT NOT NULL,
    executive_summary TEXT,
    is_purged BOOLEAN DEFAULT FALSE,
    purged_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Extracted Fields Table
CREATE TABLE IF NOT EXISTS extracted_fields (
    field_id VARCHAR(64) PRIMARY KEY DEFAULT ('fld-' || uuid_generate_v4()),
    case_id VARCHAR(64) NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    field_name VARCHAR(64) NOT NULL,
    field_label VARCHAR(128) NOT NULL,
    field_value_encrypted TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    is_uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_value TEXT,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Validation Findings Table
CREATE TABLE IF NOT EXISTS validation_findings (
    finding_id VARCHAR(64) PRIMARY KEY DEFAULT ('fnd-' || uuid_generate_v4()),
    case_id VARCHAR(64) NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    check_name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    result VARCHAR(32) NOT NULL CHECK (result IN ('passed', 'warning', 'failed')),
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    explanation TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Audit Events Table (Strictly Append-Only)
CREATE TABLE IF NOT EXISTS audit_events (
    event_id VARCHAR(64) PRIMARY KEY DEFAULT ('evt-' || uuid_generate_v4()),
    case_id VARCHAR(64) NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    actor VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ENABLE ROW-LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Enforce RLS for Table Owners as well (Prevents Bypass)
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
ALTER TABLE extracted_fields FORCE ROW LEVEL SECURITY;
ALTER TABLE validation_findings FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

-- Helper function to get current authenticated tenant from JWT / session context
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS VARCHAR AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS VARCHAR AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS VARCHAR AS $$
    SELECT NULLIF(current_setting('app.current_user_role', true), '');
$$ LANGUAGE sql STABLE;

-- ==============================================================================
-- RLS RESTRICTIVE POLICIES PER OPERATION (SELECT, INSERT, UPDATE, DELETE)
-- ==============================================================================

-- CASES: SELECT Policy
CREATE POLICY cases_select_policy ON cases
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND (
            current_user_role() IN ('admin', 'reviewer', 'viewer')
            OR (current_user_role() = 'applicant' AND created_by = current_user_id())
        )
    );

-- CASES: INSERT Policy (Server assigns tenant_id and created_by)
CREATE POLICY cases_insert_policy ON cases
    FOR INSERT
    WITH CHECK (
        tenant_id = current_tenant_id()
        AND created_by = current_user_id()
    );

-- CASES: UPDATE Policy (Reviewers and Admins only, prevent applicant modification)
CREATE POLICY cases_update_policy ON cases
    FOR UPDATE
    USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('admin', 'reviewer')
    )
    WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('admin', 'reviewer')
    );

-- CASES: DELETE Policy (Admins only)
CREATE POLICY cases_delete_policy ON cases
    FOR DELETE
    USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'admin'
    );

-- AUDIT EVENTS: Strict Append-Only (NO UPDATE OR DELETE ALLOWED)
CREATE POLICY audit_events_select_policy ON audit_events
    FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY audit_events_insert_policy ON audit_events
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

-- Disallow all UPDATE & DELETE on Audit Events
CREATE POLICY audit_events_no_update ON audit_events
    FOR UPDATE
    USING (false);

CREATE POLICY audit_events_no_delete ON audit_events
    FOR DELETE
    USING (false);

-- ==============================================================================
-- PARAMETERIZED QUERY PREPARED STATEMENTS (SQL INJECTION IMMUNITY)
-- ==============================================================================
-- PREPARE get_case_by_id(varchar, varchar) AS
--     SELECT * FROM cases WHERE case_id = $1 AND tenant_id = $2;
-- PREPARE update_case_field(text, varchar, varchar) AS
--     UPDATE extracted_fields SET reviewed_value = $1, is_edited = true, updated_at = NOW()
--     WHERE field_id = $2 AND tenant_id = $3;
