-- 2026-10-14 JST / PART: One server-ordered hand queue shared by the gallery and host controls.
-- Preserve microsecond ordering and UUID ties across refreshes; no media/role changes.
CREATE OR REPLACE FUNCTION public.cpp_live_stage_state(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; r public.cpp_live_stage_rooms%rowtype; v_people jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) THEN RAISE EXCEPTION 'Event access required' USING errcode='42501'; END IF;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id;
 SELECT * INTO r FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id AND control_epoch=c.stage_epoch;
 WITH present AS MATERIALIZED (SELECT user_id,display_name FROM public.cpp_live_event_roster(p_event_id)),
 ids AS (SELECT user_id FROM present UNION SELECT user_id FROM public.cpp_live_stage_grants WHERE room_id=r.id UNION SELECT c.host_user_id),
 people AS (SELECT i.user_id,coalesce(v.display_name,nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者') AS display_name,v.user_id IS NOT NULL AS is_present
  FROM ids i LEFT JOIN present v ON v.user_id=i.user_id LEFT JOIN public.parari_social_profiles s ON s.user_id=i.user_id
  LEFT JOIN public.profiles p ON p.user_id=i.user_id WHERE i.user_id IS NOT NULL)
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,
  'role',CASE WHEN p.user_id=c.host_user_id THEN 'host' ELSE coalesce(g.role,'viewer') END,
  'panel_slot',g.panel_slot,'hand_raised',h.user_id IS NOT NULL,'present',p.is_present,
  'ticket_id',t.id,'can_speak',coalesce(p.user_id=r.host_user_id OR g.role='questioner' OR
   (g.role='presenter' AND (r.display_mode='panel' OR r.lecturer_user_id=p.user_id)),false)) ORDER BY h.raised_at NULLS LAST,p.user_id),'[]'::jsonb) INTO v_people
 FROM people p LEFT JOIN public.cpp_live_stage_grants g ON g.room_id=r.id AND g.user_id=p.user_id
 LEFT JOIN public.cpp_live_stage_hands h ON h.room_id=r.id AND h.user_id=p.user_id
 LEFT JOIN public.cpp_live_stage_tickets t ON t.room_id=r.id AND t.user_id=p.user_id AND t.revoked_at IS NULL AND t.revoke_requested_at IS NULL;
 RETURN jsonb_build_object('room_id',r.id,'closing',r.closing_at IS NOT NULL,'version',c.version,
  'pending_count',(SELECT count(*) FROM public.cpp_live_stage_tickets t JOIN public.cpp_live_stage_rooms s ON s.id=t.room_id WHERE s.event_id=p_event_id AND t.revoke_requested_at IS NOT NULL AND t.revoked_at IS NULL),
  'display_mode',coalesce(r.display_mode,'panel'),'lecturer_user_id',coalesce(r.lecturer_user_id,c.host_user_id),'host_visible',coalesce(r.host_visible,true),
  'role',CASE WHEN auth.uid()=c.host_user_id THEN 'host' ELSE coalesce((SELECT role FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=auth.uid()),'viewer') END,
  'can_speak',cpp_private.live_stage_can_speak(r.id,auth.uid()),
  'ticket_id',(SELECT id FROM public.cpp_live_stage_tickets WHERE room_id=r.id AND user_id=auth.uid() AND revoked_at IS NULL AND revoke_requested_at IS NULL),
  'hand_raised',EXISTS(SELECT 1 FROM public.cpp_live_stage_hands WHERE room_id=r.id AND user_id=auth.uid()),'people',v_people);
END $$;
