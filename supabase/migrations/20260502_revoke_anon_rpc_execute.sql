-- ============================================================================
-- File   : 20260502_revoke_anon_rpc_execute.sql
-- Purpose: Remove anonymous execute access from authenticated-only RPCs.
-- ============================================================================

revoke execute on function public.get_last_session(uuid) from public;
revoke execute on function public.get_last_session(uuid) from anon;
grant execute on function public.get_last_session(uuid) to authenticated;

revoke execute on function public.get_library_breakdown(uuid) from public;
revoke execute on function public.get_library_breakdown(uuid) from anon;
grant execute on function public.get_library_breakdown(uuid) to authenticated;

revoke execute on function public.get_library_with_progress(uuid) from public;
revoke execute on function public.get_library_with_progress(uuid) from anon;
grant execute on function public.get_library_with_progress(uuid) to authenticated;

revoke execute on function public.get_reading_velocity(uuid, uuid[]) from public;
revoke execute on function public.get_reading_velocity(uuid, uuid[]) from anon;
grant execute on function public.get_reading_velocity(uuid, uuid[]) to authenticated;
