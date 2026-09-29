import { z } from "zod";
import { PROPERTY_TYPES } from "@/db/schema/listings";
import { MIN_PHOTOS } from "./moderation-checks";

// User submitted listing contract (docs/05 Phase 5 task 1), shared by the wizard and the API.

export const PhotoRef = z
  .object({
    storageKey: z.string().regex(/^(local\/)?uploads\/[0-9a-f-]+\/[0-9a-f-]+$/).optional(),
    sourceUrl: z.string().url().optional(),
    // Only the tiny base64 placeholder our own upload route produces; never a remote or CSS value.
    blurDataUrl: z.string().max(4000).regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/).nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    caption: z.string().trim().max(80).optional(),
  })
  .refine((p) => !!p.storageKey || !!p.sourceUrl, "Photo is missing its upload.");

export const UserListingInput = z
  .object({
    // Only landlords post on Glowy Homes; homes for sale come from the MLS.
    listingType: z.enum(["rent"]),
    propertyId: z.string().uuid("Choose the address first."),
    propertyType: z.enum(PROPERTY_TYPES).exclude(["land"]),
    beds: z.number().min(0).max(20),
    baths: z.number().min(0).max(20),
    sqft: z.number().int().min(150, "Enter the interior size.").max(30000),
    yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
    price: z.number().int().positive("Enter a price."),
    description: z.string().trim().min(40, "Describe the home in at least 40 characters.").max(4000),
    availableDate: z.string().date().optional(),
    rentalTerms: z
      .object({
        pets: z.boolean(),
        furnished: z.boolean(),
        laundry: z.enum(["In suite", "Shared", "None"]),
        parking: z.boolean(),
        leaseMinMonths: z.number().int().min(1).max(36),
        deposit: z.number().int().min(0),
        utilitiesIncluded: z.array(z.string()).max(6).default([]),
      })
      .optional(),
    photos: z.array(PhotoRef).min(MIN_PHOTOS, `Add at least ${MIN_PHOTOS} photos.`).max(30, "Use up to 30 photos."),
    contact: z.object({
      preferred: z.enum(["email", "phone"]),
      phone: z.string().trim().optional(),
      showPhone: z.boolean().default(false),
    }),
  })
  .refine((v) => v.listingType !== "rent" || (!!v.rentalTerms && !!v.availableDate), { message: "Add the rental terms and the available date.", path: ["rentalTerms"] })
  .refine((v) => v.contact.preferred !== "phone" || /^\+?\d{10,15}$/.test((v.contact.phone ?? "").replace(/[^\d+]/g, "")), { message: "Enter a phone number with area code.", path: ["contact", "phone"] });

export type UserListingInput = z.infer<typeof UserListingInput>;

export const RentalApplicationProfile = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().regex(/^\+?[\d\s().-]{10,20}$/, "Enter a phone number with area code."),
  moveInDate: z.string().date("Choose a move in date."),
  occupants: z.number().int().min(1).max(12),
  pets: z.string().trim().max(200).default(""),
  employer: z.string().trim().max(120).default(""),
  jobTitle: z.string().trim().max(120).default(""),
  annualIncome: z.number().int().min(0).max(10_000_000),
  references: z.array(z.object({ name: z.string().trim().min(1).max(80), phone: z.string().trim().max(30), relationship: z.string().trim().max(60) })).max(3).default([]),
  notes: z.string().trim().max(1500).default(""),
});
export type RentalApplicationProfile = z.infer<typeof RentalApplicationProfile>;

export const SUBMISSION_STATUSES = ["submitted", "reviewing", "approved", "declined", "withdrawn"] as const;
