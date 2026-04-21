# Solicitudes y Aprobaciones - Documentacion funcional

## 1. Objetivo

Este documento describe de forma funcional como opera el modulo de:

- Configuracion de flujos de aprobacion
- Solicitudes transaccionales
- Bandeja de aprobaciones pendientes
- Historial y trazabilidad

El objetivo es que negocio, QA, implementacion y soporte entiendan:

- que se configura,
- como se comporta el flujo,
- como se registra una solicitud,
- como se aprueba o rechaza,
- y como probarlo con datos ficticios en ambiente de pruebas.

---

## 2. Alcance del modulo

El motor comun de aprobaciones aplica a estos procesos:

1. Justificacion de atraso
2. Justificacion de falta
3. Justificacion de salida anticipada
4. Justificacion de ingreso anticipado a break
5. Solicitud de permisos
6. Solicitud de prestamos
7. Solicitud de adelanto de sueldo / anticipo
8. Solicitud de vacaciones

Todos los procesos comparten la misma logica base de aprobacion, pero cada tenant puede definir niveles distintos para cada uno.

---

## 3. Ubicacion en la aplicacion

### Configuracion

Ruta principal:

- `Configuracion > Flujos de aprobacion`
- URL: `/config/approval-flows`

Desde aqui se define:

- cuantos niveles tendra cada proceso,
- quien aprueba cada nivel,
- si el flujo esta activo,
- si el rechazo cierra la solicitud,
- si el flujo es secuencial o paralelo,
- y una plantilla comercial rapida para demos.

### Gestion

Rutas principales:

- `Gestion > Solicitudes`
- URL: `/management/requests`

- `Gestion > Aprobaciones pendientes`
- URL: `/management/approvals`

Desde aqui se hace el trabajo operativo:

- crear solicitudes,
- guardar borradores,
- enviar a aprobacion,
- revisar bandeja,
- aprobar,
- rechazar,
- revisar historial.

---

## 4. Roles funcionales involucrados

### Solicitante

Es el usuario o colaborador que registra una solicitud.

Puede:

- crear borradores,
- enviar a aprobacion,
- ver el estado,
- revisar historial,
- corregir solicitudes rechazadas.

### Aprobador

Es quien actua sobre un nivel del flujo.

Puede ser:

- jefe inmediato,
- jefe del jefe,
- responsable RRHH,
- responsable Nomina,
- rol del sistema,
- usuario especifico,
- grupo aprobador.

### Administrador del tenant / RRHH

Puede:

- configurar flujos,
- definir niveles,
- editar grupos aprobadores,
- revisar el comportamiento del flujo,
- usar el asistente rapido de configuracion.

---

## 5. Conceptos clave

### Flujo de aprobacion

Es la definicion de como debe aprobarse un proceso.

Ejemplo:

- Vacaciones
- Nivel 1: Jefe inmediato
- Nivel 2: RRHH

### Nivel de aprobacion

Es cada paso individual del flujo.

Ejemplo:

- Nivel 1: Jefe inmediato
- Nivel 2: Gerente del area
- Nivel 3: RRHH

### Solicitud

Es el registro transaccional que genera un colaborador.

Ejemplo:

- permiso,
- prestamo,
- vacaciones,
- justificacion de atraso.

### Instancia de aprobacion

Es la ejecucion real del flujo sobre una solicitud especifica.

Ejemplo:

- La solicitud de vacaciones de Carla usa el flujo `vacation_request`.
- Se crean sus pasos reales de aprobacion.

### Historial / auditoria

Es la trazabilidad completa de acciones:

- quien envio,
- quien aprobo,
- quien rechazo,
- fecha y hora,
- comentario.

---

## 6. Regla funcional base del modulo

Esta regla es obligatoria en la configuracion actual:

- Todo flujo debe tener minimo 1 nivel.
- El nivel 1 siempre debe ser el `Jefe inmediato`.

Esto garantiza una base operativa consistente incluso cuando el tenant apenas empieza a configurar sus aprobaciones.

---

## 7. Estados funcionales

### Estado general de la solicitud

Una solicitud puede estar en:

- `borrador`
- `pendiente`
- `en_aprobacion`
- `aprobado`
- `rechazado`
- `cancelado`

### Estado por nivel

Cada nivel puede estar en:

- `pendiente`
- `aprobado`
- `rechazado`
- `omitido`

---

## 8. Configuracion funcional del flujo

### 8.1. Configuracion comercial rapida

La pantalla de configuracion tiene un asistente rapido pensado para demos, preventa y ambientes de prueba.

Ese asistente pregunta:

1. Cuantos niveles de aprobacion quieres.
2. Luego abre una ventana para capturar por cada nivel:
   - cargo del aprobador
   - correo del aprobador

### Regla del asistente

- Soporta de 1 a 4 niveles para demo.
- El nivel 1 queda fijo como `Jefe inmediato`.
- Los correos y cargos capturados sirven como referencia funcional y comercial.
- El motor real sigue resolviendo aprobadores por estructura organizacional y reglas del tenant.

### Ejemplo de configuracion rapida

Proceso:

- Solicitud de vacaciones

Configuracion:

1. Nivel 1
   - Cargo: Jefe inmediato
   - Correo: `supervisor.operaciones@demo.hrcloud.ec`
2. Nivel 2
   - Cargo: Responsable RRHH
   - Correo: `rrhh@demo.hrcloud.ec`

Resultado funcional:

- La solicitud de vacaciones primero pasa por el supervisor.
- Si aprueba, pasa a RRHH.
- Si RRHH aprueba, la solicitud queda aprobada.

---

## 9. Configuracion tecnica del flujo

Ademas del asistente, existe el editor tecnico completo.

Desde ahi se define:

- nombre del flujo,
- descripcion,
- modo de ejecucion,
- flujo activo o inactivo,
- rechazo cierra la solicitud,
- siguiente nivel se activa al aprobar,
- auto primer nivel a futuro,
- definicion manual de cada nivel.

### Tipos de aprobador disponibles

- Jefe inmediato
- Jefe del jefe
- Responsable RRHH
- Responsable Nomina
- Rol del sistema
- Usuario especifico
- Grupo aprobador

### Reglas del editor

- El nivel 1 no se puede mover ni eliminar.
- El nivel 1 no puede cambiarse a otro tipo distinto de `Jefe inmediato`.
- Desde el nivel 2 en adelante si se puede:
  - mover,
  - quitar,
  - cambiar tipo de aprobador,
  - asociar rol, usuario o grupo.

---

## 10. Flujo de trabajo de una solicitud

### Paso 1. Registro

El usuario entra al modulo correspondiente:

- Justificaciones
- Permisos
- Prestamos
- Adelantos
- Vacaciones

Crea una solicitud y puede:

- Guardar borrador
- Guardar y enviar

### Paso 2. Borrador

Si el usuario guarda borrador:

- la solicitud no entra al motor de aprobacion,
- puede editarse despues,
- todavia no tiene decision final.

### Paso 3. Envio a aprobacion

Si el usuario selecciona `Guardar y enviar`:

- se guarda la solicitud,
- se crea la instancia de aprobacion,
- se crean los niveles reales,
- se activa el nivel 1,
- el estado general pasa a `en_aprobacion`.

### Paso 4. Bandeja del aprobador

El aprobador entra a:

- `Gestion > Aprobaciones pendientes`

En la bandeja ve:

- tipo de solicitud,
- colaborador,
- nivel actual,
- prioridad,
- tiempo pendiente,
- fecha de envio.

### Paso 5. Decision

El aprobador abre el detalle y debe registrar una nota obligatoria para:

- aprobar,
- rechazar.

### Paso 6. Resultado

Si aprueba:

- el sistema marca el nivel como `aprobado`,
- y activa el siguiente nivel si aplica.

Si rechaza:

- el sistema marca el nivel como `rechazado`,
- y cierra la solicitud cuando la regla del flujo asi lo indique.

### Paso 7. Historial

En cualquier momento, si la solicitud ya paso al motor, se puede ver:

- historial del flujo,
- niveles,
- auditoria,
- comentarios,
- fechas,
- usuarios que actuaron.

---

## 11. Reglas funcionales de aprobacion

### Regla 1. Secuencial

Si el flujo es secuencial:

- el nivel 2 no inicia hasta que el nivel 1 apruebe.

Ejemplo:

- Vacaciones
- Nivel 1: Jefe inmediato
- Nivel 2: RRHH

Comportamiento:

- RRHH no ve nada hasta que el supervisor apruebe.

### Regla 2. Paralela

Si el flujo es paralelo:

- pueden existir niveles o grupos que se habilitan en paralelo segun configuracion.

### Regla 3. Rechazo inmediato

Si `rechazo cierra la solicitud = Si`:

- cualquier rechazo termina el proceso.

### Regla 4. Comentario obligatorio

Actualmente la nota es obligatoria tanto para:

- aprobar,
- rechazar.

Esto fortalece auditoria y pruebas.

### Regla 5. Fallback

Si un proceso no tiene flujo propio configurado:

- el sistema usa fallback del catalogo.

Fallback general:

- 1 nivel
- aprobador = jefe inmediato

Fallback especial para:

- prestamos
- adelantos
- vacaciones

Fallback:

- nivel 1 = jefe inmediato
- nivel 2 = RRHH

---

## 12. Como funciona cada modulo de solicitud

### 12.1. Justificaciones

Soporta:

- atraso
- falta
- salida anticipada
- ingreso anticipado a break

El usuario registra:

- colaborador
- tipo de justificacion
- fecha
- motivo
- adjunto opcional

### 12.2. Permisos

El usuario registra:

- tipo
- fecha inicio
- fecha fin
- hora inicio
- hora fin
- horas solicitadas
- motivo

### 12.3. Prestamos

El usuario registra:

- monto solicitado
- moneda
- numero de cuotas
- motivo

### 12.4. Adelantos

El usuario registra:

- monto solicitado
- moneda
- fecha estimada de pago
- motivo

### 12.5. Vacaciones

El usuario registra:

- fecha inicio
- fecha fin
- dias solicitados
- saldo disponible declarado
- motivo

---

## 13. Ejemplo funcional 1 - Solicitud de permiso con 1 nivel

### Configuracion

Proceso:

- Solicitud de permisos

Flujo:

- Nivel 1: Jefe inmediato

### Ejecucion

1. Ana registra un permiso medico.
2. Guarda y envia.
3. El sistema crea la solicitud y activa el nivel 1.
4. El supervisor entra a `Aprobaciones pendientes`.
5. Abre el detalle.
6. Escribe nota:
   - "Permiso validado con respaldo medico."
7. Aprueba.
8. El sistema marca la solicitud como `aprobada`.

### Resultado

- Estado final: `aprobado`
- Historial: envio + aprobacion + comentario

---

## 14. Ejemplo funcional 2 - Vacaciones con 2 niveles

### Configuracion

Proceso:

- Solicitud de vacaciones

Flujo:

- Nivel 1: Jefe inmediato
- Nivel 2: RRHH

### Ejecucion

1. Carla registra vacaciones del 10 al 14 de junio.
2. Guarda y envia.
3. El nivel 1 queda pendiente para el supervisor.
4. El supervisor aprueba con nota:
   - "Operacion cubierta durante esos dias."
5. El sistema activa el nivel 2.
6. RRHH revisa saldo y calendario interno.
7. RRHH aprueba con nota:
   - "Saldo disponible confirmado."
8. La solicitud queda `aprobada`.

### Resultado

- Estado general: `aprobado`
- Nivel 1: `aprobado`
- Nivel 2: `aprobado`

---

## 15. Ejemplo funcional 3 - Prestamo rechazado

### Configuracion

Proceso:

- Solicitud de prestamos

Flujo:

- Nivel 1: Jefe inmediato
- Nivel 2: RRHH

### Ejecucion

1. Miguel solicita un prestamo.
2. Guarda y envia.
3. El supervisor aprueba.
4. RRHH revisa el caso.
5. RRHH rechaza con nota:
   - "El colaborador ya mantiene un prestamo activo."

### Resultado

- Estado general: `rechazado`
- El flujo termina.
- La solicitud puede revisarse desde historial.
- El solicitante puede corregir y reenviar si el proceso del negocio lo permite.

---

## 16. Ejemplo funcional 4 - Solicitud rechazada y corregida

### Caso

1. Daniela registra una justificacion de atraso.
2. El supervisor la rechaza con nota:
   - "Falta adjuntar explicacion completa."
3. La solicitud queda `rechazada`.
4. Daniela abre la solicitud rechazada.
5. Corrige el motivo.
6. La vuelve a enviar a aprobacion.

### Resultado

- Se conserva trazabilidad.
- El solicitante puede corregir sin perder contexto funcional.

---

## 17. Bandeja de aprobaciones pendientes

La bandeja esta pensada para trabajo diario del aprobador.

Muestra:

- flujo,
- colaborador,
- paso actual,
- prioridad,
- tiempo pendiente,
- fecha de envio.

Tambien destaca:

- urgencias,
- pendientes de mas de 24 horas,
- niveles activos por revisar.

### Acciones disponibles

- Ver detalle
- Aprobar
- Rechazar
- Revisar historial

---

## 18. Trazabilidad y auditoria

Cada solicitud aprobable debe dejar registro de:

- quien la envio,
- que flujo uso,
- que niveles se generaron,
- quien aprobo,
- quien rechazo,
- fecha y hora,
- comentario,
- estado final.

Esto permite:

- control interno,
- soporte,
- seguimiento por RRHH,
- auditoria funcional.

---

## 19. Comportamiento en ambiente de pruebas

En este ambiente se permite trabajar con datos ficticios para poder avanzar en:

- demo,
- pruebas funcionales,
- validacion visual,
- presentacion comercial.

Eso significa que:

- la configuracion de flujos puede abrir incluso si Supabase no tiene todo el backend listo,
- el modulo puede usar datos mock cuando el backend no responde,
- la experiencia funcional se puede probar de extremo a extremo.

En produccion, el modulo debera operar sobre el Supabase productivo correspondiente.

---

## 20. Que debe probar QA

### Configuracion

1. Entrar a `Configuracion > Flujos de aprobacion`.
2. Verificar que abre la lista de procesos.
3. Abrir configuracion rapida.
4. Elegir 1, 2, 3 o 4 niveles.
5. Verificar que el nivel 1 siempre sea `Jefe inmediato`.
6. Registrar cargo y correo por nivel.
7. Aplicar al flujo.
8. Guardar el flujo.

### Solicitudes

1. Entrar a `Gestion > Solicitudes`.
2. Crear una solicitud por cada modulo.
3. Guardar borrador.
4. Editar borrador.
5. Enviar a aprobacion.
6. Verificar cambio a `en_aprobacion`.

### Aprobaciones

1. Entrar a `Gestion > Aprobaciones pendientes`.
2. Abrir el detalle.
3. Aprobar con nota.
4. Rechazar con nota.
5. Confirmar que no deja aprobar ni rechazar sin comentario.

### Historial

1. Abrir historial de una solicitud.
2. Validar pasos.
3. Validar auditoria.
4. Validar comentarios y fechas.

---

## 21. Resumen ejecutivo

El modulo funciona bajo una idea simple:

1. Se configura un flujo por proceso.
2. Todo flujo empieza por el jefe inmediato.
3. El colaborador registra una solicitud.
4. La solicitud entra al motor comun.
5. Los aprobadores actuan desde una bandeja.
6. Toda decision queda auditada.

La configuracion actual ya permite:

- probar el modulo con datos ficticios,
- hacer demostraciones comerciales,
- operar en ambiente de prueba,
- y dejar lista la base funcional para produccion.

---

## 22. Referencias dentro del frontend

Pantallas:

- `/config/approval-flows`
- `/management/requests`
- `/management/requests/justifications`
- `/management/requests/permissions`
- `/management/requests/loans`
- `/management/requests/salary-advances`
- `/management/requests/vacations`
- `/management/approvals`

Archivos principales:

- `src/pages/config/ApprovalFlowsPage.tsx`
- `src/pages/management/RequestsHomePage.tsx`
- `src/pages/management/PendingApprovalsPage.tsx`
- `src/features/requests/components/TransactionalRequestPage.tsx`
- `src/features/approvals/components/PendingApprovalDetailModal.tsx`

