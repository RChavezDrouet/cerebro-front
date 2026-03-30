// Agrega esta tarjeta en el grid de opciones de Configuración.
// Ajusta la navegación según tu router real.

import { Cpu } from 'lucide-react'

{
  title: 'Biométricos / Ubicaciones',
  description:
    'Asigna alias operativos a los biométricos del tenant para que RRHH y empleados vean Recepción, Bodega, Sala de reuniones, etc.',
  icon: Cpu,
  onClick: () => navigate('/configuracion/biometricos'),
}
