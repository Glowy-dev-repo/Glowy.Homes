/** The GlowHomes mark: the house from the brand logo (public/brand/logo-color.svg). Uses the current text color. Decorative. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 27 100 42" aria-hidden focusable="false" className={className} fill="currentColor">
      <path d="M99.975,59.486c0,1.768-1.429,3.198-3.196,3.198H58.779c-0.901,0-1.714-0.371-2.296-0.975l-25.08-25.901L5.478,61.748c-0.58,0.58-1.378,0.937-2.261,0.937c-1.766,0-3.195-1.431-3.195-3.198c0-0.883,0.358-1.682,0.935-2.259L29.18,28.989c0.579-0.577,1.379-0.937,2.261-0.937c0.901,0,1.715,0.373,2.295,0.973l7.348,7.592h19.7v-8.896h8.479v8.896H79.55c0.957,0,1.818,0.423,2.405,1.089l17.229,19.673C99.677,57.943,99.975,58.683,99.975,59.486z M22.589,58.375h6.974v-6.978h-6.974V58.375z M33.104,58.375h6.973v-6.978h-6.973V58.375z M22.589,68.361h6.974v-6.978h-6.974V68.361z M33.104,68.397h6.973v-6.979h-6.973V68.397z" />
    </svg>
  );
}
