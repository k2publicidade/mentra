-- Incremental server-side undo support. Apply after 202610090001, once.
BEGIN;
CREATE OR REPLACE FUNCTION public.mentra_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE restore boolean := TG_TABLE_NAME='items'
 AND current_user IN ('postgres','service_role')
 AND pg_catalog.current_setting('mentra.restore_timestamps',true)='on';
BEGIN
 IF TG_OP='INSERT' THEN
  IF NOT coalesce(restore,false) THEN NEW.created_at:=clock_timestamp();NEW.updated_at:=NEW.created_at; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='profiles' THEN
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Immutable identity' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.type IS DISTINCT FROM OLD.type THEN
   RAISE EXCEPTION 'Immutable identity, owner or type' USING ERRCODE='23514';
  END IF;
 END IF;
 NEW.created_at:=OLD.created_at;
 IF NOT coalesce(restore,false) THEN NEW.updated_at:=clock_timestamp(); END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.mentra_touch() FROM PUBLIC,anon,authenticated;
COMMIT;
