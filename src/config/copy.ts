import { brand } from "./brand";

// Product names built from the brand, so they follow a rename.
const brandWord = brand.name.split(" ")[0];

/** Name of the automated home estimate, shown with its range (for example "Glowy value range"). */
export const estimateLabel = `${brandWord} value range`;
