import { z } from 'zod'

export const TurnType = z.enum(['diurno', 'vespertino', 'nocturno'])

export const TurnSchema = z.object({
  name: z.string().min(2, 'Nombre requerido').max(60),
  type: TurnType,
  color: z.string().min(4).max(20),
  // DB valida 1..7 (ISO: Lun=1 ... Dom=7)
  days: z.array(z.number().int().min(1).max(7)).min(1, 'Selecciona al menos 1 día'),
  is_active: z.boolean()
})

export type TurnForm = z.infer<typeof TurnSchema>
