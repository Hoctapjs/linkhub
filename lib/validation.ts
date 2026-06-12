/**
 * Zod validation schemas for LinkHub
 */

import { z } from 'zod';

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const textField = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

const optionalTextField = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    });

const nullableTextField = (maxLength: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    })
    .refine((value) => value === undefined || value === null || value.length <= maxLength, {
      message: `Must be at most ${maxLength} characters`,
    });

const tagSchema = z.string().trim().min(1).max(30);

/**
 * Schema for creating a new link
 * Used for POST /api/links
 */
export const createLinkSchema = z.object({
  title: textField(200),
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .refine(isHttpUrl, 'URL must use http:// or https://'),
  description: optionalTextField(1000),
  favicon: optionalTextField(2048),
  category: optionalTextField(50),
  notes: optionalTextField(2000),
  tags: z.array(tagSchema).max(20, 'Maximum 20 tags allowed').default([]),
});

/**
 * Schema for updating a link
 * Used for PUT /api/links/[id]
 * All fields are optional
 */
export const updateLinkSchema = z
  .object({
    title: textField(200).optional(),
    url: z
      .string()
      .trim()
      .min(1, 'URL is required')
      .refine(isHttpUrl, 'URL must use http:// or https://')
      .optional(),
    description: nullableTextField(1000),
    favicon: optionalTextField(2048),
    category: nullableTextField(50),
    notes: nullableTextField(2000),
    tags: z.array(tagSchema).max(20, 'Maximum 20 tags allowed').optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

/**
 * Schema for query parameters on GET /api/links
 */
export const listLinksQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  category: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  tag: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
});

/**
 * Schema for user registration
 * Used for POST /api/register
 */
export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  name: optionalTextField(80),
});

/**
 * Schema for user login
 * Used by NextAuth Credentials provider
 */
export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(100),
});

/**
 * Infer TypeScript types from schemas
 */
export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type ListLinksQuery = z.infer<typeof listLinksQuerySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
