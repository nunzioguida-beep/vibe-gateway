-- Conversation history for VIBE gateway

CREATE TABLE conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  whatsapp_msg_id TEXT        UNIQUE,          -- null for assistant turns
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  message_type    TEXT        NOT NULL CHECK (message_type IN ('text', 'audio')),
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at      ON messages(conversation_id, created_at);

-- Keep conversations.updated_at current whenever a message is inserted
CREATE OR REPLACE FUNCTION touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_conversation
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION touch_conversation();
