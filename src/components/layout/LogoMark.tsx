/** The Glowy Homes mark: a house with a lit window and a soft blue glow, on a navy tile. Decorative. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false" className={className}>
      <defs>
        <radialGradient id="gh-glow" cx="24" cy="28" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#93C5FD" stopOpacity="0.6" />
          <stop offset="0.5" stopColor="#3B82F6" stopOpacity="0.22" />
          <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#0B1B3F" />
      <circle cx="24" cy="28" r="17" fill="url(#gh-glow)" />
      <path d="M12.5 23 24 13.5 35.5 23" fill="none" stroke="#FFFFFF" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 21v13.5h16V21" fill="none" stroke="#FFFFFF" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="24.5" width="6" height="6" rx="1.25" fill="#DBEAFE" />
    </svg>
  );
}
