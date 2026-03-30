# Base Front — Ajuste de biométricos por ubicación

Fecha: 2026-03-18

## Criterio funcional implementado

- La **serie del biométrico** se ingresa **únicamente en Cerebro**.
- **Base no crea series**.
- Base **consulta los dispositivos biométricos** del tenant y permite asignar una **ubicación operativa** para uso humano.
- En formularios y reportes se muestra la **ubicación** como identificador principal.
- El **serial number** queda como identificador técnico para trazabilidad, integración y diagnóstico.

## Cambios incluidos

### 1. Configuración > Dispositivos biométricos
- Ruta activada: `/config/biometricos`
- Texto funcional actualizado para indicar que la serie nace en Cerebro.
- Tabla con serie, ubicación operativa, última conexión y estado.
- Edición inline de ubicación.
- Compatibilidad con columnas `serial_number` o `serial_no`, y con `location` o `name`.

### 2. Empleados > creación/edición
- Los selectores biométricos ahora muestran la **ubicación** primero y el serial como referencia secundaria.
- Texto aclaratorio incorporado: la serie se registra en Cerebro y Base solo consume el catálogo para asignación operativa.

### 3. Reporte de marcaciones
- Se muestra la **ubicación biométrica** resuelta desde el catálogo de dispositivos.
- Se muestra el **tipo de marcación** con etiquetas legibles: Facial, Huella digital, Código, Tarjeta, USB, Web/PWA.
- La **novedad** ahora abre una ventana modal para no saturar la tabla.

### 4. Look & Feel
- Ajustes visuales en shell, menú lateral, cards, inputs, selects, badges y modal.
- Corrección de contraste en campos desplegables para evitar fondo claro con texto poco legible.

## Observación técnica

El repositorio entregado ya contenía errores de TypeScript ajenos a este ajuste. Por eso el build global del proyecto no queda validado desde `npm run build`, aunque los archivos modificados para este cambio sí fueron verificados a nivel sintáctico.

- 2026-03-18 (build fix): se excluyeron módulos legacy/no usados del compilado TS, se corrigió el tipado de EmployeeFormPage y el listado de biométricos prioriza ubicación sobre serial.
