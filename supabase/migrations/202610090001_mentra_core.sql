-- Standalone schema; requires Supabase auth.users and auth.uid(). Never reapply.
BEGIN;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL DEFAULT 'Pessoa' CHECK (char_length(name) BETWEEN 1 AND 100 AND btrim(name) <> ''),
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
 onboarded boolean NOT NULL DEFAULT false,
 morning_summary boolean NOT NULL DEFAULT false,
 evening_summary boolean NOT NULL DEFAULT false,
 proactivity text NOT NULL DEFAULT 'balanced' CHECK (char_length(proactivity) BETWEEN 1 AND 40 AND btrim(proactivity) <> ''),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.mentra_validate_profile() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
  RAISE EXCEPTION 'Invalid timezone' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER mentra_profile_validate BEFORE INSERT OR UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.mentra_validate_profile();
CREATE FUNCTION public.mentra_create_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 display_name text := NEW.raw_user_meta_data ->> 'name';
 zone text := NEW.raw_user_meta_data ->> 'timezone';
BEGIN
 IF display_name IS NULL OR char_length(display_name) NOT BETWEEN 1 AND 100 OR btrim(display_name) = '' THEN display_name := 'Pessoa'; END IF;
 IF zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = zone) THEN zone := 'America/Sao_Paulo'; END IF;
 INSERT INTO public.profiles(id,name,timezone) VALUES(NEW.id,btrim(display_name),zone);
 RETURN NEW;
END;
$$;
CREATE TRIGGER mentra_auth_profile AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.mentra_create_profile();
REVOKE ALL ON FUNCTION public.mentra_validate_profile(), public.mentra_create_profile() FROM PUBLIC, anon, authenticated;
-- Backfill existing Auth accounts without changing Auth identities or credentials.
INSERT INTO public.profiles(id,name,timezone)
SELECT u.id,
 CASE WHEN char_length(u.raw_user_meta_data->>'name') BETWEEN 1 AND 100 AND btrim(u.raw_user_meta_data->>'name')<>'' THEN btrim(u.raw_user_meta_data->>'name') ELSE 'Pessoa' END,
 CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name=u.raw_user_meta_data->>'timezone') THEN u.raw_user_meta_data->>'timezone' ELSE 'America/Sao_Paulo' END
FROM auth.users u;

CREATE TABLE public.items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 type text NOT NULL CHECK (type IN ('task','event','reminder','memory')),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300 AND btrim(title) <> ''),
 notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 10000),
 due_at timestamptz CHECK (due_at IS NULL OR isfinite(due_at)),
 priority boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
 source text NOT NULL DEFAULT 'manual' CHECK (char_length(source) BETWEEN 1 AND 2000 AND btrim(source) <> ''),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(updated_at))
);
CREATE INDEX mentra_items_owner ON public.items(user_id);

CREATE FUNCTION public.mentra_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.created_at:=clock_timestamp();NEW.updated_at:=NEW.created_at;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME = 'profiles' THEN
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Immutable identity' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.type IS DISTINCT FROM OLD.type THEN
   RAISE EXCEPTION 'Immutable identity, owner or type' USING ERRCODE='23514';
  END IF;
 END IF;
 NEW.created_at := OLD.created_at;
 NEW.updated_at := clock_timestamp();
 RETURN NEW;
END;
$$;
CREATE TRIGGER mentra_profile_touch BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.mentra_touch();
CREATE TRIGGER mentra_item_touch BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.mentra_touch();
REVOKE ALL ON FUNCTION public.mentra_touch() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles, public.items FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(name,timezone,onboarded,morning_summary,evening_summary,proactivity) ON public.profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.items TO authenticated;
GRANT ALL ON public.profiles, public.items TO service_role;
CREATE POLICY mentra_profile_select ON public.profiles FOR SELECT TO authenticated USING(id=(SELECT auth.uid()));
CREATE POLICY mentra_profile_update ON public.profiles FOR UPDATE TO authenticated USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));
CREATE POLICY mentra_item_owner ON public.items FOR ALL TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));

-- Three unique slots enforce the hard limit even if concurrent snapshots are stale.
ALTER TABLE public.items ADD COLUMN priority_slot smallint;
ALTER TABLE public.items ADD CONSTRAINT mentra_priority_slot_valid CHECK(
 ((priority AND status='pending') AND priority_slot IS NOT NULL AND priority_slot BETWEEN 1 AND 3)
 OR ((NOT priority OR status<>'pending') AND priority_slot IS NULL)
);
ALTER TABLE public.items ADD CONSTRAINT mentra_priority_unique UNIQUE(user_id,priority_slot);
CREATE FUNCTION public.mentra_priority_slot() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.priority AND NEW.status='pending' THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text,0));
  IF TG_OP='UPDATE' AND OLD.priority AND OLD.status='pending' THEN
   NEW.priority_slot:=OLD.priority_slot;
  ELSE
   SELECT s.n INTO NEW.priority_slot FROM pg_catalog.generate_series(1,3) s(n)
   WHERE NOT EXISTS(SELECT 1 FROM public.items i WHERE i.user_id=NEW.user_id AND i.priority_slot=s.n AND i.id<>NEW.id)
   ORDER BY s.n LIMIT 1;
  END IF;
  IF NEW.priority_slot IS NULL THEN RAISE EXCEPTION 'Maximum three pending priorities' USING ERRCODE='23514'; END IF;
 ELSE NEW.priority_slot:=NULL;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER mentra_priority_slots BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.mentra_priority_slot();
REVOKE ALL ON FUNCTION public.mentra_priority_slot() FROM PUBLIC,anon,authenticated;
CREATE INDEX mentra_items_agenda ON public.items(user_id,status,due_at) WHERE due_at IS NOT NULL;
CREATE INDEX mentra_items_type ON public.items(user_id,type,status);

CREATE TABLE public.messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('user','assistant')),
 content text NOT NULL CHECK(char_length(content) BETWEEN 1 AND 20000 AND btrim(content)<>''),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at))
);
CREATE INDEX mentra_messages_owner_time ON public.messages(user_id,created_at,id);
CREATE TABLE public.undo_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 changes jsonb NOT NULL CHECK(jsonb_typeof(changes)='array' AND jsonb_array_length(changes)>0),
 used boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at))
);
CREATE INDEX mentra_undo_owner_time ON public.undo_actions(user_id,created_at);
CREATE TABLE public.chat_requests (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id text NOT NULL CHECK(char_length(request_id) BETWEEN 1 AND 128 AND request_id ~ '^[a-zA-Z0-9_.:-]+$'),
 input text NOT NULL CHECK(char_length(input) BETWEEN 1 AND 2000 AND btrim(input)<>''),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at)),
 PRIMARY KEY(user_id,request_id)
);
CREATE TABLE public.conversations (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 state jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(state)='object'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(updated_at))
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.undo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages,public.undo_actions,public.chat_requests,public.conversations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.messages,public.undo_actions,public.chat_requests,public.conversations TO authenticated;
GRANT ALL ON public.messages,public.undo_actions,public.chat_requests,public.conversations TO service_role;
CREATE POLICY mentra_message_read ON public.messages FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY mentra_undo_read ON public.undo_actions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY mentra_request_read ON public.chat_requests FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY mentra_conversation_read ON public.conversations FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

COMMIT;
