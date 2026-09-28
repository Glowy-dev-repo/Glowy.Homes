import { z } from "zod";
import { PROPERTY_TYPES } from "@/db/schema/listings";

// Partner agents receive leads by ZIP code; landlords receive inquiries on the rentals they post.
export const PRO_SIGNUP_TYPES = ["agent", "landlord"] as const;
export const MAX_ZIP_CODES = 30;

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => /^\+?\d{10,15}$/.test(v), "Enter a phone number with area code.");

const price = z.number().int().min(0).max(100_000_000).nullable().optional();

export const ProProfileFields = z.object({
  displayName: z.string().trim().min(2, "Enter the name clients will see.").max(80),
  brokerageName: z.string().trim().max(120).optional().transform((v) => v || null),
  phone,
  bio: z.string().trim().max(1500).optional().transform((v) => v || null),
  languages: z.array(z.string().trim().min(2).max(3)).min(1).max(6).default(["en"]),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  zipCodes: z
    .array(z.string().trim().regex(/^\d{5}$/, "Use five digit ZIP codes."))
    .max(MAX_ZIP_CODES, `Choose up to ${MAX_ZIP_CODES} ZIP codes.`)
    .default([]),
  priceMin: price,
  priceMax: price,
  homeTypes: z.array(z.enum(PROPERTY_TYPES)).max(PROPERTY_TYPES.length).default([]),
});

const priceOrder = (v: { priceMin?: number | null; priceMax?: number | null }) => v.priceMin == null || v.priceMax == null || v.priceMin <= v.priceMax;

export const ProSignup = ProProfileFields.extend({
  proType: z.enum(PRO_SIGNUP_TYPES),
  licenseNumber: z.string().trim().max(40).optional().transform((v) => v || null),
})
  .refine((v) => v.proType === "landlord" || !!v.licenseNumber, { message: "Enter your license number.", path: ["licenseNumber"] })
  .refine((v) => v.proType === "landlord" || v.zipCodes.length > 0, { message: "Choose at least one ZIP code you serve.", path: ["zipCodes"] })
  .refine(priceOrder, { message: "The lowest price must be below the highest price.", path: ["priceMax"] });

export const ProProfileUpdate = ProProfileFields.partial()
  .extend({
    // No defaults here: a partial update must not clear ZIP codes or home types it did not send.
    zipCodes: z.array(z.string().trim().regex(/^\d{5}$/, "Use five digit ZIP codes.")).max(MAX_ZIP_CODES, `Choose up to ${MAX_ZIP_CODES} ZIP codes.`).optional(),
    homeTypes: z.array(z.enum(PROPERTY_TYPES)).optional(),
    isAcceptingLeads: z.boolean().optional(),
    leadCapPerDay: z.number().int().min(1).max(50).optional(),
  })
  .refine(priceOrder, { message: "The lowest price must be below the highest price.", path: ["priceMax"] });

export const ReviewInput = z.object({
  leadId: z.string().uuid(),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5),
  body: z.string().trim().max(2000).optional(),
});
