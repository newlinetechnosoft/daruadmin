CREATE OR REPLACE FUNCTION check_journal_entry_balanced_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_id TEXT;
  v_status TEXT;
  v_total_debit BIGINT;
  v_total_credit BIGINT;
  v_line_count INT;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN NULL;
    END IF;
    v_entry_id := NEW.id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_entry_id := OLD.journal_entry_id;
    ELSE
      v_entry_id := NEW.journal_entry_id;
    END IF;
  END IF;

  SELECT posting_status INTO v_status
  FROM journal_entries
  WHERE id = v_entry_id;

  IF v_status IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_status = 'submitted' THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0),
      COUNT(*)
    INTO
      v_total_debit,
      v_total_credit,
      v_line_count
    FROM journal_lines
    WHERE journal_entry_id = v_entry_id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'Submitted journal entry % must have at least 2 lines (found %)', v_entry_id, v_line_count
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION 'Submitted journal entry % is unbalanced: total debit (%) <> total credit (%)',
        v_entry_id, v_total_debit, v_total_credit
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_total_debit <= 0 THEN
      RAISE EXCEPTION 'Submitted journal entry % line totals must be greater than zero (found %)',
        v_entry_id, v_total_debit
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS check_journal_entry_balanced_trigger ON journal_lines;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER check_journal_entry_balanced_trigger
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_journal_entry_balanced_fn();
--> statement-breakpoint
DROP TRIGGER IF EXISTS check_journal_entry_header_balanced_trigger ON journal_entries;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER check_journal_entry_header_balanced_trigger
AFTER INSERT OR UPDATE ON journal_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_journal_entry_balanced_fn();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_journal_lines_mutation_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT posting_status INTO v_status FROM journal_entries WHERE id = OLD.journal_entry_id;
    IF v_status = 'submitted' THEN
      RAISE EXCEPTION 'Mutation not allowed: journal lines for submitted entry % are immutable (DELETE)',
        OLD.journal_entry_id
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT posting_status INTO v_status FROM journal_entries WHERE id = OLD.journal_entry_id;
    IF v_status = 'submitted' THEN
      RAISE EXCEPTION 'Mutation not allowed: journal lines for submitted entry % are immutable (UPDATE)',
        OLD.journal_entry_id
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.journal_entry_id <> OLD.journal_entry_id THEN
      SELECT posting_status INTO v_status FROM journal_entries WHERE id = NEW.journal_entry_id;
      IF v_status = 'submitted' THEN
        RAISE EXCEPTION 'Mutation not allowed: cannot reassign line to submitted entry %',
          NEW.journal_entry_id
          USING ERRCODE = 'restrict_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS prevent_journal_lines_mutation_trigger ON journal_lines;
--> statement-breakpoint
CREATE TRIGGER prevent_journal_lines_mutation_trigger
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION prevent_journal_lines_mutation_fn();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_journal_entries_mutation_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.posting_status = 'submitted' THEN
      RAISE EXCEPTION 'Deletion not allowed: submitted journal entry % is immutable', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.posting_status = 'submitted' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.voucher_no IS DISTINCT FROM OLD.voucher_no
         OR NEW.voucher_type IS DISTINCT FROM OLD.voucher_type
         OR NEW.fiscal_year_id IS DISTINCT FROM OLD.fiscal_year_id
         OR NEW.posting_date IS DISTINCT FROM OLD.posting_date
         OR NEW.narration IS DISTINCT FROM OLD.narration
         OR NEW.ref_type IS DISTINCT FROM OLD.ref_type
         OR NEW.ref_id IS DISTINCT FROM OLD.ref_id
         OR NEW.event IS DISTINCT FROM OLD.event
         OR NEW.posting_status IS DISTINCT FROM OLD.posting_status
         OR NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_at IS DISTINCT FROM OLD.created_at
         OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
        RAISE EXCEPTION 'Mutation not allowed: submitted journal entry % fields are immutable', OLD.id
          USING ERRCODE = 'restrict_violation';
      END IF;

      IF OLD.is_reversed = true AND NEW.is_reversed = false THEN
        RAISE EXCEPTION 'Mutation not allowed: cannot un-reverse journal entry %', OLD.id
          USING ERRCODE = 'restrict_violation';
      END IF;

      IF OLD.reversed_by IS NOT NULL AND NEW.reversed_by IS DISTINCT FROM OLD.reversed_by THEN
        RAISE EXCEPTION 'Mutation not allowed: cannot change reversed_by on journal entry %', OLD.id
          USING ERRCODE = 'restrict_violation';
      END IF;

      IF OLD.reversal_of IS NOT NULL AND NEW.reversal_of IS DISTINCT FROM OLD.reversal_of THEN
        RAISE EXCEPTION 'Mutation not allowed: cannot change reversal_of on journal entry %', OLD.id
          USING ERRCODE = 'restrict_violation';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS prevent_journal_entries_mutation_trigger ON journal_entries;
--> statement-breakpoint
CREATE TRIGGER prevent_journal_entries_mutation_trigger
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_journal_entries_mutation_fn();
