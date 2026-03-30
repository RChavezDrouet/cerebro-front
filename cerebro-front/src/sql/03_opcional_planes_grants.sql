-- Solo si SettingsPage sigue dando 403 al guardar planes.
grant usage on schema cerebro to authenticated;
grant select, insert, update, delete on table cerebro.subscription_plans to authenticated;
notify pgrst, 'reload schema';
