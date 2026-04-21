# Guia de usuario - Solicitudes y aprobaciones

## 1. Para que sirve este modulo

Este modulo permite que un colaborador registre solicitudes y que los responsables las aprueben o rechacen dentro del sistema.

Sirve para gestionar:

- justificaciones,
- permisos,
- prestamos,
- adelantos,
- vacaciones,
- y aprobaciones por niveles.

---

## 2. Que puede hacer cada usuario

### Colaborador / solicitante

Puede:

- crear una solicitud,
- guardarla como borrador,
- enviarla a aprobacion,
- revisar el estado,
- ver el historial,
- corregir una solicitud rechazada.

### Aprobador

Puede:

- ver solicitudes pendientes,
- revisar el detalle,
- aprobar,
- rechazar,
- dejar comentario obligatorio.

### Administrador / RRHH

Puede:

- configurar los flujos,
- definir niveles de aprobacion,
- administrar grupos aprobadores.

---

## 3. Dónde entrar

### Para crear solicitudes

Ingresa a:

- `Gestion > Solicitudes`

Ahí verás accesos a:

- Justificaciones
- Permisos
- Prestamos
- Adelantos
- Vacaciones

### Para aprobar o rechazar

Ingresa a:

- `Gestion > Aprobaciones pendientes`

### Para configurar niveles de aprobacion

Ingresa a:

- `Configuracion > Flujos de aprobacion`

---

## 4. Tipos de solicitudes disponibles

### Justificaciones

Permite registrar:

- atraso,
- falta,
- salida anticipada,
- ingreso anticipado a break.

### Permisos

Permisos por horas o dias.

### Prestamos

Solicitud de prestamo interno.

### Adelantos

Solicitud de adelanto o anticipo de sueldo.

### Vacaciones

Solicitud de dias de vacaciones.

---

## 5. Cómo crear una solicitud

### Paso 1

Entra al tipo de solicitud que necesitas.

Ejemplo:

- `Gestion > Solicitudes > Vacaciones`

### Paso 2

Haz clic en:

- `Nueva solicitud`

o en el botón equivalente del modulo.

### Paso 3

Llena los datos del formulario.

Ejemplos:

- motivo,
- fechas,
- horas,
- monto,
- cuotas,
- saldo disponible,
- adjunto, si aplica.

### Paso 4

Elige una de estas opciones:

- `Guardar borrador`
- `Guardar y enviar`

---

## 6. Diferencia entre borrador y enviar

### Guardar borrador

Usa esta opcion cuando todavia no quieres que el flujo de aprobacion empiece.

El borrador:

- no llega a los aprobadores,
- se puede editar,
- se puede eliminar.

### Guardar y enviar

Usa esta opcion cuando ya quieres que la solicitud entre al flujo de aprobacion.

Al enviar:

- se activa el nivel 1,
- el estado cambia a `en_aprobacion`,
- la solicitud aparece en la bandeja del aprobador correspondiente.

---

## 7. Cómo revisar el estado de una solicitud

En la pantalla del modulo verás tarjetas o registros con su estado.

Los estados principales son:

- `Borrador`
- `En aprobacion`
- `Aprobado`
- `Rechazado`
- `Cancelado`

Tambien puedes abrir:

- `Historial`

para ver el detalle del flujo.

---

## 8. Qué significa cada estado

### Borrador

La solicitud fue guardada pero aun no se envio.

### En aprobacion

La solicitud ya esta siendo revisada por uno o mas aprobadores.

### Aprobado

La solicitud ya completo el flujo y fue aprobada.

### Rechazado

La solicitud fue rechazada en algun nivel.

### Cancelado

La solicitud fue anulada o cerrada sin seguir el flujo.

---

## 9. Cómo funciona la aprobacion

Cada proceso puede tener uno o varios niveles.

La regla base actual es:

- siempre existe al menos 1 nivel,
- el nivel 1 siempre es el jefe inmediato.

Segun la configuracion del tenant, luego pueden existir mas niveles como:

- jefe del jefe,
- RRHH,
- Nomina,
- rol del sistema,
- usuario especifico,
- grupo aprobador.

---

## 10. Cómo aprobar o rechazar una solicitud

### Paso 1

Ingresa a:

- `Gestion > Aprobaciones pendientes`

### Paso 2

Busca la solicitud que deseas revisar.

Puedes filtrar por:

- tipo,
- prioridad,
- colaborador.

### Paso 3

Haz clic en:

- `Ver detalle`

### Paso 4

Revisa la informacion:

- origen de la solicitud,
- datos del colaborador,
- nivel actual,
- historial,
- comentarios anteriores.

### Paso 5

Escribe una nota.

La nota es obligatoria para:

- aprobar,
- rechazar.

### Paso 6

Selecciona:

- `Aprobar`

o

- `Rechazar`

---

## 11. Qué pasa si la solicitud se aprueba

Si el nivel actual aprueba:

- el sistema marca ese nivel como `aprobado`,
- y si existe otro nivel, activa el siguiente,
- o deja la solicitud como `aprobada` si ya era el ultimo nivel.

---

## 12. Qué pasa si la solicitud se rechaza

Si el nivel actual rechaza:

- el sistema marca el nivel como `rechazado`,
- la solicitud pasa a `rechazado` segun la regla del flujo,
- el solicitante puede revisar la nota,
- y corregir la solicitud si el proceso lo permite.

---

## 13. Cómo corregir una solicitud rechazada

### Paso 1

Abre el modulo donde registraste la solicitud.

Ejemplo:

- Vacaciones
- Permisos
- Prestamos

### Paso 2

Ubica la solicitud con estado:

- `Rechazado`

### Paso 3

Haz clic en:

- `Corregir y reenviar`

o

- `Editar`

### Paso 4

Revisa la observacion del rechazo.

### Paso 5

Corrige los datos.

### Paso 6

Vuelve a seleccionar:

- `Guardar y enviar`

---

## 14. Cómo ver el historial

Cuando una solicitud ya fue enviada al flujo, puedes abrir:

- `Historial`

Desde ahí puedes ver:

- niveles del flujo,
- quien aprobo,
- quien rechazo,
- fecha y hora,
- comentarios,
- auditoria de acciones.

---

## 15. Ejemplo simple - Solicitud de vacaciones

### Caso

Carla quiere pedir vacaciones del 10 al 14 de junio.

### Flujo configurado

- Nivel 1: Jefe inmediato
- Nivel 2: RRHH

### Paso a paso

1. Carla entra a `Gestion > Solicitudes > Vacaciones`.
2. Crea una nueva solicitud.
3. Registra:
   - fecha inicio,
   - fecha fin,
   - dias solicitados,
   - motivo.
4. Hace clic en `Guardar y enviar`.
5. El sistema cambia el estado a `En aprobacion`.
6. El jefe inmediato revisa la solicitud y aprueba con una nota.
7. La solicitud pasa a RRHH.
8. RRHH revisa y aprueba con otra nota.
9. El estado final queda `Aprobado`.

---

## 16. Ejemplo simple - Solicitud rechazada

### Caso

Miguel solicita un prestamo.

### Paso a paso

1. Miguel registra el monto y el motivo.
2. Envía la solicitud.
3. El supervisor la aprueba.
4. RRHH la revisa.
5. RRHH rechaza con la nota:
   - "Ya existe un prestamo activo."
6. El estado cambia a `Rechazado`.
7. Miguel puede revisar el historial y la observacion.

---

## 17. Recomendaciones para el usuario

- Antes de enviar, revisa bien los datos.
- Si no estas seguro, guarda como borrador.
- Lee siempre la observacion cuando una solicitud sea rechazada.
- Usa el historial para entender en que nivel esta tu solicitud.
- Si eres aprobador, deja notas claras y concretas.

---

## 18. Preguntas frecuentes

### No veo mi solicitud en aprobaciones

Porque la bandeja de aprobaciones es solo para usuarios que son aprobadores vigentes del nivel actual.

### No puedo aprobar sin comentario

Es correcto. La nota es obligatoria.

### Puedo editar una solicitud ya enviada

No directamente si ya esta en aprobacion. Si fue rechazada, normalmente debes corregirla y reenviarla.

### Puedo eliminar una solicitud

Solo si esta en borrador o segun las reglas del proceso.

### Siempre aprueba primero el jefe inmediato

Si. En la configuracion actual, el primer nivel es obligatorio y corresponde al jefe inmediato.

---

## 19. Resumen rapido

1. Crea tu solicitud.
2. Guarda borrador o enviala.
3. Revisa el estado.
4. Si eres aprobador, entra a la bandeja.
5. Decide con una nota.
6. Consulta el historial cuando necesites trazabilidad.

