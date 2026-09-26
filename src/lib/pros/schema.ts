import { z } from "zod";

export const PRO_SIGNUP_TYPES = ["agent", "lender", "landlord"] as const;

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => /^\+?\d{10,15}$/.test(v), "Enter a phone number with area code.");

export const ProProfileFields = z.object({
  displayName: z.string().trim().min(2, "Enter the name clients will see.").max(80),
  brokerageName: z.string().trim().max(120).optional().transform((v) => v || null),
  phone,
  bio: z.string().trim().max(1500).optional().transform((v) => v || null),
  languages: z.array(z.string().trim().min(2).max(3)).min(1).max(6).default(["en"]),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  serviceAreaIds: z.array(z.string().uuid()).min(1, "Choose at least one area you serve.").max(12, "Choose up to 12 areas."),
});

export const ProSignup = ProProfileFields.extend({
  proType: z.enum(PRO_SIGNUP_TYPES),
  licenseNumber: z.string().trim().max(40).optional().transform((v) => v || null),
}).refine((v) => v.proType === "landlord" || !!v.licenseNumber, { message: "Enter your license number.", path: ["licenseNumber"] });

export const ProProfileUpdate = ProProfileFields.partial().extend({
  isAcceptingLeads: z.boolean().optional(),
  leadCapPerDay: z.number().int().min(1).max(50).optional(),
});

export const ReviewInput = z.object({
  leadId: z.string().uuid(),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5),
  body: z.string().trim().max(2000).optional(),
});
