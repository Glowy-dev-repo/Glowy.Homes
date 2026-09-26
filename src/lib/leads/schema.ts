import { z } from "zod";
import { LEAD_TYPES } from "@/db/schema/leads";

// Lead form contract (docs/02 POST /api/leads). Consent is required for every lead (CAN-SPAM and TCPA in the US, CASL in Canada), and the
// consent text version is stored with the lead (docs/06 section 1).

export const CONSENT_TEXT = "You agree to be contacted by a licensed professional about this home.";
export const CONSENT_TEXT_VERSION = "2026-09-v1";

const windowSchema = z.object({
  date: z.string().date(),
  slot: z.enum(["morning", "afternoon", "evening"]),
});

export const LeadInput = z
  .object({
    leadType: z.enum(LEAD_TYPES),
    name: z.string().trim().min(1, "Enter your name.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address, like name@example.com."),
    phone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/[^\d+]/g, "") : undefined))
      .refine((v) => v === undefined || /^\+?\d{10,15}$/.test(v), "Enter a phone number with area code."),
    message: z.string().trim().max(2000).optional(),
    listingId: z.string().uuid().optional(),
    propertyId: z.string().uuid().optional(),
    /** Contact from a pro's profile page: route to that pro. */
    proId: z.string().uuid().optional(),
    /** Where the consumer is buying, for leads without a home (preapproval). */
    citySlug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
    consent: z.literal(true, { message: "Please agree to be contacted so a professional can reply." }),
    tour: z
      .object({ mode: z.enum(["in_person", "video"]), windows: z.array(windowSchema).min(1).max(3) })
      .optional(),
    preapproval: z
      .object({ price: z.number().int().positive().optional(), downPayment: z.number().int().nonnegative().optional(), income: z.number().int().nonnegative().optional() })
      .optional(),
    sourcePage: z.string().max(300).optional(),
    turnstileToken: z.string().optional(),
  })
  .refine((v) => v.leadType !== "tour" || !!v.tour, { message: "Pick at least one time window.", path: ["tour"] })
  .refine((v) => !["tour", "rental_inquiry"].includes(v.leadType) || !!v.listingId, { message: "A listing is required.", path: ["listingId"] })
  .refine((v) => v.leadType !== "contact" || !!v.listingId || !!v.proId, { message: "Choose a home or a professional to contact.", path: ["listingId"] })
  .refine((v) => v.leadType !== "preapproval" || !!v.citySlug || !!v.listingId || !!v.propertyId, { message: "Choose where you are buying.", path: ["citySlug"] });

export type LeadInput = z.infer<typeof LeadInput>;
