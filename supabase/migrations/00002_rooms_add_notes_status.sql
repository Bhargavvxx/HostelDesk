-- Add new columns IF NOT EXISTS
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Safely populate and enforce NOT NULL on status
UPDATE rooms SET status = 'active' WHERE status IS NULL;
ALTER TABLE rooms ALTER COLUMN status SET NOT NULL;

-- Enforce CHECK constraint
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (status IN ('active', 'archived'));

-- Migrate floor data to notes and drop floor IF EXISTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='floor') THEN
        UPDATE rooms SET notes = floor WHERE floor IS NOT NULL;
        ALTER TABLE rooms DROP COLUMN floor;
    END IF;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS rooms_owner_room_number_unique ON rooms (owner_id, lower(room_number)) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS rooms_owner_status_idx ON rooms (owner_id, status) WHERE deleted = false;
