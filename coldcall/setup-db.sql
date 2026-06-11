-- Coldcall System — Schema
-- Ausführen im Supabase SQL Editor: https://supabase.com/dashboard/project/uiqritxzmgmutsetkzof/editor

CREATE TABLE IF NOT EXISTS coldcall_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text NOT NULL,
  phone text,
  address text,
  city text,
  category text,
  website text,
  google_place_id text UNIQUE,
  status text DEFAULT 'pending',
  -- pending | calling | called | interested | callback | not_interested | dnc | invalid
  call_count integer DEFAULT 0,
  last_called_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coldcall_calls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES coldcall_leads(id),
  retell_call_id text UNIQUE,
  status text DEFAULT 'registered',
  -- registered | ongoing | ended | error
  outcome text,
  -- interested | callback_requested | not_interested | no_answer | voicemail | completed
  transcript text,
  transcript_object jsonb,
  duration_seconds integer,
  analysis_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coldcall_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  retell_agent_id text NOT NULL,
  retell_llm_id text,
  version integer DEFAULT 1,
  prompt text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_coldcall_leads_status   ON coldcall_leads(status);
CREATE INDEX IF NOT EXISTS idx_coldcall_leads_created  ON coldcall_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_coldcall_calls_lead     ON coldcall_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_coldcall_calls_retell   ON coldcall_calls(retell_call_id);

-- RPC: Lead-Status + call_count atomar updaten
CREATE OR REPLACE FUNCTION coldcall_increment_lead(p_lead_id uuid, p_status text)
RETURNS void AS $$
  UPDATE coldcall_leads
  SET status = p_status,
      call_count = call_count + 1,
      last_called_at = now()
  WHERE id = p_lead_id;
$$ LANGUAGE sql;

-- RLS: nur über Service Key erreichbar
ALTER TABLE coldcall_leads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coldcall_calls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coldcall_agents ENABLE ROW LEVEL SECURITY;
