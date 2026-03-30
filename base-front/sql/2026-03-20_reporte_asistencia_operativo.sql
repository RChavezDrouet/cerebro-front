-- HRCloud Base - Reporte operativo de asistencia
-- Complemento opcional para enriquecer reportes con tipo de marcación.
-- El frontend entregado funciona con get_daily_attendance_report + get_punch_sources_summary.
-- Este archivo queda como referencia para evolución del backend.

create or replace function attendance.resolve_marking_type_label(
  p_source text,
  p_verify_type text default null,
  p_method text default null
)
returns text
language sql
immutable
as $$
  select case
    when upper(coalesce(p_source,'')) in ('WEB','PWA','REMOTE','REMOTA') then 'Remota'
    when upper(coalesce(p_source,'')) in ('USB','IMPORT') then 'USB'
    when coalesce(p_verify_type,'') = '15' or upper(coalesce(p_method,'')) like '%FACIAL%' then 'Facial'
    when coalesce(p_verify_type,'') = '1' or upper(coalesce(p_method,'')) like '%HUELLA%' then 'Huella digital'
    when coalesce(p_verify_type,'') = '3' or upper(coalesce(p_method,'')) like '%CODIGO%' then 'Código'
    when upper(coalesce(p_method,'')) like '%TARJETA%' or upper(coalesce(p_method,'')) like '%CARD%' or upper(coalesce(p_method,'')) like '%RFID%' then 'Tarjeta'
    when upper(coalesce(p_source,'')) = 'BIOMETRIC' then 'Biométrico'
    else '—'
  end
$$;

comment on function attendance.resolve_marking_type_label(text,text,text)
is 'Convierte source + verify_type + auth_method a etiqueta legible para reportes de asistencia.';
