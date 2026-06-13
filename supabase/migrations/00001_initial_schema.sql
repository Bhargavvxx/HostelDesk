-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- 1. Rooms
-- ==========================================
CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    room_number TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    floor TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, owner_id) -- For same-owner FK safety
);

CREATE TRIGGER update_rooms_updated_at
    BEFORE INSERT OR UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX ON rooms (owner_id, updated_at);

-- ==========================================
-- 2. Students
-- ==========================================
CREATE TABLE students (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    room_id UUID,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    emergency_contact TEXT NOT NULL,
    address TEXT,
    blood_group TEXT,
    photo_path TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, owner_id), -- For same-owner FK safety
    FOREIGN KEY (room_id, owner_id) REFERENCES rooms(id, owner_id)
);

CREATE TRIGGER update_students_updated_at
    BEFORE INSERT OR UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX ON students (owner_id, updated_at);

-- ==========================================
-- 3. Student Documents
-- ==========================================
CREATE TABLE student_documents (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    student_id UUID NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('aadhar', 'id_proof', 'other')),
    file_path TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (student_id, owner_id) REFERENCES students(id, owner_id)
);

CREATE TRIGGER update_student_documents_updated_at
    BEFORE INSERT OR UPDATE ON student_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX ON student_documents (owner_id, updated_at);

-- ==========================================
-- 4. Fee Records
-- ==========================================
CREATE TABLE fee_records (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    student_id UUID NOT NULL,
    amount_due NUMERIC NOT NULL CHECK (amount_due >= 0),
    amount_paid NUMERIC NOT NULL CHECK (amount_paid >= 0),
    due_date DATE,
    payment_date DATE,
    payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'upi', 'bank', 'other')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'paid')),
    notes TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (student_id, owner_id) REFERENCES students(id, owner_id),
    CHECK (amount_due = 0 OR due_date IS NOT NULL)
);

CREATE TRIGGER update_fee_records_updated_at
    BEFORE INSERT OR UPDATE ON fee_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX ON fee_records (owner_id, updated_at);

-- ==========================================
-- 5. Attendance
-- ==========================================
CREATE TABLE attendance (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    student_id UUID NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'late')),
    notes TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, date), -- One attendance record per student per calendar day
    FOREIGN KEY (student_id, owner_id) REFERENCES students(id, owner_id)
);

CREATE TRIGGER update_attendance_updated_at
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX ON attendance (owner_id, updated_at);

-- ==========================================
-- 6. Movement Logs
-- ==========================================
CREATE TABLE movement_logs (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    student_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('out_pass', 'overnight', 'home_visit')),
    is_open BOOLEAN NOT NULL,
    check_out_time TIMESTAMPTZ NOT NULL,
    check_in_time TIMESTAMPTZ,
    expected_return_at TIMESTAMPTZ,
    purpose TEXT,
    destination TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (student_id, owner_id) REFERENCES students(id, owner_id),
    CHECK ((is_open = true AND check_in_time IS NULL) OR (is_open = false AND check_in_time IS NOT NULL)),
    CHECK (expected_return_at IS NULL OR expected_return_at >= check_out_time),
    CHECK (check_in_time IS NULL OR check_in_time >= check_out_time)
);

CREATE TRIGGER update_movement_logs_updated_at
    BEFORE INSERT OR UPDATE ON movement_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX ON movement_logs (owner_id, updated_at);

-- Partial Unique Index to enforce one open movement log per student
CREATE UNIQUE INDEX single_open_movement_idx 
ON movement_logs (student_id) 
WHERE is_open = true AND deleted = false;
