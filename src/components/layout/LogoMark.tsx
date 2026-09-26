/** The Glowy Homes mark: a house with a lit window and a warm glow, on an ink tile. Decorative. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false" className={className}>
      <defs>
        <radialGradient id="gh-glow" cx="24" cy="28" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FCD34D" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#F59E0B" stopOpacity="0.18" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#1C1917" />
      <circle cx="24" cy="28" r="17" fill="url(#gh-glow)" />
      <path d="M12.5 23 24 13.5 35.5 23" fill="none" stroke="#FAFAF9" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 21v13.5h16V21" fill="none" stroke="#FAFAF9" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="24.5" width="6" height="6" rx="1.25" fill="#FCD34D" />
    </svg>
  );
}
