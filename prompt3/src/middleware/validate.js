const { z } = require('zod');

/**
 * Create an Express middleware that validates request body against a Zod schema.
 * @param {z.ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Zod schema for URL creation request.
 */
const createUrlSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .max(2048, 'URL must be under 2048 characters'),
  customSlug: z
    .string()
    .min(3, 'Custom slug must be at least 3 characters')
    .max(30, 'Custom slug must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens, and underscores allowed')
    .optional()
    .or(z.literal('')),
  expiresInMinutes: z
    .number()
    .int()
    .min(1, 'Expiration must be at least 1 minute')
    .max(525600, 'Expiration must be at most 365 days')
    .optional()
    .nullable(),
});

module.exports = { validateBody, createUrlSchema };
