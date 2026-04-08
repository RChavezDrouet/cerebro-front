// src/pages/employees/employeeSchemas.ts
// v4.5.0 - Schemas actualizados con nuevos campos

import { z } from 'zod';

// ─────────────────────────────────────────
// Departamento
// ─────────────────────────────────────────
export const departmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export type Department = z.infer<typeof departmentSchema>;

// ─────────────────────────────────────────
// Formulario de Empleado
// ─────────────────────────────────────────
export const employeeFormSchema = z.object({
  // ── Campos originales ──
  first_name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100),
  last_name: z
    .string()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .max(100),
  email: z.string().email('Correo electrónico inválido'),
  phone: z.string().optional().nullable(),
  position: z.string().optional().nullable(),

  // ── Campos nuevos ──
  employee_number: z
    .string()
    .min(1, 'El número de empleado es requerido')
    .max(50),
  cedula: z
    .string()
    .min(5, 'La cédula debe tener al menos 5 caracteres')
    .max(20),
  department_id: z.string().uuid('Selecciona un departamento').nullable().optional(),
  is_department_head: z.boolean().default(false),

  // Foto facial (base64 o URL ya guardada)
  facial_photo_url: z.string().nullable().optional(),
  facial_photo_base64: z.string().nullable().optional(), // temporal, solo para upload

  // Discapacidad
  has_disability: z.boolean().default(false),
  disability_card_number: z
    .string()
    .nullable()
    .optional(),
  disability_percentage: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional(),
}).superRefine((data, ctx) => {
  if (data.has_disability) {
    if (!data.disability_card_number || data.disability_card_number.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['disability_card_number'],
        message: 'El número de carnet es requerido cuando hay discapacidad',
      });
    }
    if (data.disability_percentage == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['disability_percentage'],
        message: 'El porcentaje de discapacidad es requerido',
      });
    }
  }
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

// ─────────────────────────────────────────
// Config de Reconocimiento Facial
// ─────────────────────────────────────────
export const facialRecognitionConfigSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),

  min_brightness: z.number().int().min(0).max(255).default(40),
  max_brightness: z.number().int().min(0).max(255).default(220),
  min_contrast: z.number().int().min(0).max(100).default(30),
  min_sharpness: z.number().int().min(0).max(100).default(50),

  min_face_width_px: z.number().int().min(50).max(1000).default(100),
  min_face_height_px: z.number().int().min(50).max(1000).default(100),

  max_tilt_angle: z.number().int().min(0).max(45).default(15),

  capture_count: z.number().int().min(1).max(10).default(3),
  capture_interval_sec: z.number().int().min(1).max(10).default(2),

  enforce_on_enrollment: z.boolean().default(true),
  enforce_on_attendance: z.boolean().default(true),
  require_liveness: z.boolean().default(false),
});

export type FacialRecognitionConfig = z.infer<typeof facialRecognitionConfigSchema>;

// Defaults para cuando no existe configuración guardada
export const FACIAL_CONFIG_DEFAULTS: FacialRecognitionConfig = {
  min_brightness: 40,
  max_brightness: 220,
  min_contrast: 30,
  min_sharpness: 50,
  min_face_width_px: 100,
  min_face_height_px: 100,
  max_tilt_angle: 15,
  capture_count: 3,
  capture_interval_sec: 2,
  enforce_on_enrollment: true,
  enforce_on_attendance: true,
  require_liveness: false,
};
