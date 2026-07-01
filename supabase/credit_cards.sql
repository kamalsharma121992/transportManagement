-- Run this in Supabase SQL Editor to enable credit card tracking
-- Safe for existing projects: only adds new table + nullable columns

CREATE TABLE IF NOT EXISTS credit_cards (
  id SERIAL PRIMARY KEY,
  holder TEXT NOT NULL REFERENCES partners(name),
  bank_name TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'VISA',
  last_four TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (holder, bank_name, network, last_four)
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_holder ON credit_cards(holder);
CREATE INDEX IF NOT EXISTS idx_credit_cards_active ON credit_cards(is_active);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on credit_cards" ON credit_cards FOR ALL USING (true) WITH CHECK (true);

-- Nullable FKs — existing rows stay valid without a card
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS card_id INTEGER REFERENCES credit_cards(id);
ALTER TABLE capital_contributions ADD COLUMN IF NOT EXISTS card_id INTEGER REFERENCES credit_cards(id);

CREATE INDEX IF NOT EXISTS idx_expenses_card ON expenses(card_id);
CREATE INDEX IF NOT EXISTS idx_capital_contributions_card ON capital_contributions(card_id);

INSERT INTO credit_cards (holder, bank_name, network, last_four, label) VALUES
  ('Subham', 'HDFC', 'Rupay', '', 'HDFC Rupay - Subham'),
  ('Subham', 'Indusind', 'VISA', '', 'Indusind VISA - Subham'),
  ('Subham', 'Kotak', 'Rupay', '', 'Kotak Rupay - Subham'),
  ('Bimal', 'Yes Bank', 'Rupay', '', 'Yes Bank Rupay - Bimal'),
  ('Mohit', 'KreditBee', 'Rupay', '', 'KreditBee Rupay - Mohit')
ON CONFLICT (holder, bank_name, network, last_four) DO NOTHING;
