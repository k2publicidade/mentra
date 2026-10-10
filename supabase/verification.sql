-- READ ONLY. Run inventory first; never paste migration over conflicting existing objects.
SELECT current_database(), current_user;
SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename;
-- After applying: all six expected tables must exist and have RLS enabled.
WITH expected(name) AS (VALUES ('profiles'),('items'),('messages'),('undo_actions'),('chat_requests'),('conversations'))
SELECT e.name, c.oid IS NOT NULL AS exists, coalesce(c.relrowsecurity,false) AS rls_enabled
FROM expected e LEFT JOIN pg_catalog.pg_class c ON c.relname=e.name AND c.relnamespace='public'::regnamespace AND c.relkind='r'
ORDER BY e.name;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename IN ('profiles','items','messages','undo_actions','chat_requests','conversations') ORDER BY tablename,policyname;
SELECT n.nspname AS schema,c.relname AS table_name,t.tgname AS trigger_name
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND t.tgname LIKE 'mentra_%' ORDER BY n.nspname,c.relname,t.tgname;
SELECT c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
WHERE k.connamespace='public'::regnamespace AND k.conname LIKE 'mentra_priority_%';
SELECT p.proname, p.prosecdef AS security_definer,p.proconfig,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE 'mentra_%';
-- Do not export auth.users, credentials or personal row contents for verification.
