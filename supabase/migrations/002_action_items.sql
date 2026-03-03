-- Action items extracted from transcripts or created manually
CREATE TABLE action_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transcript_id TEXT REFERENCES transcripts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,                    -- "Lutfiya", "Chris", or NULL
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'done' | 'dismissed'
  priority TEXT DEFAULT 'medium',      -- 'low' | 'medium' | 'high' | 'urgent'
  due_date DATE,
  source_text TEXT,                    -- The transcript excerpt that generated this item
  created_by TEXT DEFAULT 'ai',        -- 'ai' (auto-extracted) | 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_assigned ON action_items(assigned_to);
CREATE INDEX idx_action_items_transcript ON action_items(transcript_id);

-- Activity log for tracking all system events
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type TEXT NOT NULL,           -- 'action_item_created' | 'action_item_updated' |
                                      -- 'transcript_processed' | 'query_asked' | 'manual_note'
  entity_type TEXT,                   -- 'action_item' | 'transcript' | 'query'
  entity_id TEXT,                     -- ID of the related record
  actor TEXT,                         -- 'system' | 'Lutfiya' | 'Chris'
  summary TEXT NOT NULL,              -- Human-readable description
  metadata JSONB DEFAULT '{}',        -- Flexible extra data
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_log_type ON activity_log(event_type);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
