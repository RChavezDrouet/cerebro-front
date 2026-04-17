# Checklist de despliegue

## Base de datos
- [ ] Respaldo realizado
- [ ] Scripts ejecutados en orden
- [ ] Feature flags visibles en `public.tenants`
- [ ] Tablas de nómina creadas
- [ ] Tablas de desempeño creadas
- [ ] RLS activado
- [ ] Vistas creadas
- [ ] Auditoría registrando eventos

## Frontend Base
- [ ] Menú lateral actualizado
- [ ] Rutas protegidas por flags
- [ ] Tabs dinámicos en ficha del colaborador
- [ ] Pantallas mínimas creadas
- [ ] Estados visuales estandarizados
- [ ] Filtros y exportaciones funcionando

## QA funcional
- [ ] Crear período de nómina
- [ ] Crear ejecución
- [ ] Calcular nómina
- [ ] Cerrar nómina
- [ ] Crear ciclo de desempeño
- [ ] Asignar evaluaciones
- [ ] Registrar puntajes
- [ ] Publicar resultado
- [ ] Generar plan de mejora
- [ ] Crear plan de capacitación

## Seguridad
- [ ] Un tenant no ve otro tenant
- [ ] Colaborador no ve datos ajenos
- [ ] Módulo oculto si feature flag está apagado
- [ ] Base bloquea si tenant está paused/suspended
- [ ] Periodo cerrado no permite modificación