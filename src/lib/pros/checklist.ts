export type ChecklistItem = { key: "photo" | "bio" | "phone" | "zips" | "brokerage"; done: boolean; href: string; label: string };

/** What an agent still needs to add so their public profile looks complete. */
export function profileChecklist(p: { photoUrl: string | null; bio: string | null; phone: string | null; zipCodes: string[]; brokerageName: string | null }): ChecklistItem[] {
  const href = "/pro/profile";
  return [
    { key: "photo", done: !!p.photoUrl, href, label: "Add a profile photo" },
    { key: "bio", done: !!p.bio?.trim(), href, label: "Write a short bio" },
    { key: "phone", done: !!p.phone?.trim(), href, label: "Add a business phone" },
    { key: "zips", done: p.zipCodes.length > 0, href, label: "Choose the ZIP codes you serve" },
    { key: "brokerage", done: !!p.brokerageName?.trim(), href, label: "Add your brokerage" },
  ];
}
