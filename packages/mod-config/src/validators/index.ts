import { z } from 'zod'

// ─── Auth Validators ───────────────────────────────────────────────

export const loginSchema = z.object({
  pin: z.string().min(1, 'PIN es requerido'),
  user_id: z.string().uuid().optional(),
})

export const refreshSchema = z.object({})

// ─── User Validators ───────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(255),
  email: z.string().email('Email inválido').optional().nullable(),
  pin: z.string().min(4, 'PIN debe tener al menos 4 caracteres').max(20),
  role: z.string().optional().default('staff'),
  color: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  role: z.string().optional(),
  color: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  active: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
})

export const changePinSchema = z.object({
  pin: z.string().min(4, 'PIN debe tener al menos 4 caracteres').max(20),
})

// ─── Role Validators ───────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100),
  permissions: z.array(z.string()).default([]),
  isSystem: z.boolean().optional().default(false),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
})

// ─── Settings Validators ───────────────────────────────────────────

export const updateSettingSchema = z.object({
  value: z.string(),
  module: z.string().optional(),
})

export const bulkUpdateSettingsSchema = z.object({
  items: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
      module: z.string().optional(),
    }),
  ).min(1, 'Al menos un item es requerido'),
})
