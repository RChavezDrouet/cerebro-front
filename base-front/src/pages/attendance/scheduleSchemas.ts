import { z } from 'zod'

const TimeSchema = z
  .string()
  .min(1, 'Hora requerida')
  .refine((v) => /^\d{2}:\d{2}(:\d{2})?$/.test(v), 'Formato inválido (HH:mm)')

export const ScheduleSchema = z.object({
  turn_id: z.string().uuid('Turno inválido'),
  name: z.string().min(2, 'Nombre requerido'),
  color: z.string().min(1, 'Color requerido'),
  entry_time: TimeSchema,
  exit_time: TimeSchema,
  meal_enabled: z.boolean(),
  meal_start: TimeSchema.nullable().optional(),
  meal_end: TimeSchema.nullable().optional(),
  crosses_midnight: z.boolean(),
  is_active: z.boolean(),

  // ✅ NUEVO: tolerancias y corte
  grace_in_minutes: z.number().int().min(0, 'Min 0').max(180, 'Max 180'),
  early_out_minutes: z.number().int().min(0, 'Min 0').max(180, 'Max 180'),
  day_cutoff_time: TimeSchema
})

export type ScheduleForm = z.infer<typeof ScheduleSchema>


