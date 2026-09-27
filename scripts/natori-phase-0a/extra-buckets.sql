-- TEST ONLY: remaining existing buckets, metadata verified read-only 2026-09-27.
DO $$ BEGIN
  IF current_setting('phase_t.sandbox', true) IS DISTINCT FROM 'ephemeral' THEN
    RAISE EXCEPTION 'Phase T sandbox required';
  END IF;
END $$;
INSERT INTO storage.buckets(id,name,public)
VALUES ('aura-assets','aura-assets',false), ('card-assets','card-assets',false),
       ('natori-portfolio','natori-portfolio',true);
