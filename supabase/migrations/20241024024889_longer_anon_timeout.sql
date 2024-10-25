ALTER ROLE "anon" SET "statement_timeout" TO '8s';
NOTIFY pgrst, 'reload config';
