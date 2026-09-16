-- El advisor de seguridad marca 2 vistas creadas después del fix general
-- de security_invoker (20260903172401_views_security_invoker.sql) que
-- quedaron SECURITY DEFINER: ignoran el RLS de las tablas base y anon
-- tiene SELECT otorgado sobre ambas (grants por defecto del schema public).
-- marketing_contactos_segmentados expone email/telefono/empresa de TODOS
-- los contactos de marketing; vw_webinar_contacts expone lo mismo de los
-- inscritos a webinars. Mismo fix que las 32 vistas anteriores: con
-- security_invoker=true la vista corre con los permisos del que consulta,
-- así que vuelve a respetar el RLS admin-only ya configurado en las
-- tablas base (marketing_contactos, webinar_inscripciones).
alter view public.marketing_contactos_segmentados set (security_invoker = true);
alter view public.vw_webinar_contacts set (security_invoker = true);
