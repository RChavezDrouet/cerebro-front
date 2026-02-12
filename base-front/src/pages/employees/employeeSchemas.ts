import { z } from 'zod'

export const EmployeeSchema = z.object({
  employee_code: z.string().min(1, 'Número de empleado requerido').max(40),
  first_name: z.string().min(1, 'Nombres requeridos').max(80),
  last_name: z.string().min(1, 'Apellidos requeridos').max(80),
  status: z.enum(['active', 'inactive']),
  schedule_id: z.string().uuid('Horario requerido'),
  biometric_employee_code: z.string().max(40).optional().nullable()
})

export type EmployeeForm = z.infer<typeof EmployeeSchema>
