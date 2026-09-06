CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO settings (key, value)
VALUES ('whatsapp_link', 'https://chat.whatsapp.com/REPLACE_WITH_GROUP_INVITE_LINK')
ON CONFLICT (key) DO NOTHING;
