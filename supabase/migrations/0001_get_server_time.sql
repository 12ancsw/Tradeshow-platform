-- Used by the "/" test page to verify the app can reach Supabase with a real SELECT.
create or replace function public.get_server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

grant execute on function public.get_server_time() to anon, authenticated;
