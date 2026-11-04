import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const forgetPasswordSearchSchema = z.object({
  phone: z
    .union([z.string(), z.number()])
    .transform((val) =>
      String(val)
        .replace(/^["']|["']$/g, '')
        .trim(),
    )
    .optional()
    .default(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/forget-password')({
  validateSearch: (search) => forgetPasswordSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/forgot-password',
      search: {
        phone: search.phone,
        redirect: search.redirect,
      },
    })
  },
  component: () => null,
})
