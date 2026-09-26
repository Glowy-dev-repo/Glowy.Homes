/** Long form page shell for static text pages (about, terms, privacy). */
export function Prose({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="container-page max-w-3xl py-10 md:py-14 [&_h2]:mt-10 [&_h2]:text-h2 [&_li]:mt-1 [&_p]:mt-4 [&_p]:text-body [&_p]:text-neutral-700 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-body [&_ul]:text-neutral-700">
      <h1 className="text-h1 md:text-display">{title}</h1>
      {updated && <p className="!mt-2 !text-small !text-neutral-500">Last updated {updated}</p>}
      {children}
    </article>
  );
}
