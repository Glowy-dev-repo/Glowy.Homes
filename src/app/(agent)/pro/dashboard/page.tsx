import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { profileChecklist } from "@/lib/pros/checklist";
import { cn } from "@/lib/utils";
import { proDashboard } from "@/server/data/pro-dashboard";
import { proForEdit } from "@/server/data/pros";

export const metadata: Metadata = { title: "Overview", robots: { index: false }, alternates: { canonical: "/pro/dashboard" } };
export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = { tour: "Tour request", contact: "Question", sell: "Selling", rental_inquiry: "Rental question", rental_application: "Rental application" };

function Section({ title, testId, children }: { title: string; testId?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5" data-testid={testId}>
      <h2 className="text-h3">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Where an application stands, shown until the agent is live. */
function ApplicationSteps({ status }: { status: string }) {
  const steps = [
    { label: "Application received", done: true },
    { label: "License check, typically one business day", done: status === "active" },
    { label: "Live: Glowy Homes can assign you leads", done: status === "active" },
  ];
  return (
    <ol className="space-y-3" data-testid="application-steps">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3 text-body">
          {s.done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden /> : <Circle className="size-5 shrink-0 text-neutral-400" aria-hidden />}
          <span className={cn(!s.done && "text-neutral-600")}>
            {s.label}
            <span className="sr-only">{s.done ? ", done" : ", not yet"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function ProDashboardPage() {
  const session = await auth();
  const pro = await proForEdit(session!.user.id);
  if (!pro) redirect("/pro/join");
  const checklist = profileChecklist(pro);
  const left = checklist.filter((c) => !c.done);

  if (pro.status !== "active") {
    return (
      <div className="space-y-6">
        <h1 className="text-h1">Welcome, {pro.displayName.split(" ")[0]}</h1>
        <Section title="Your application">
          {pro.status === "pending" ? (
            <ApplicationSteps status={pro.status} />
          ) : (
            <p className="text-body text-neutral-700">Your partner account is paused. We emailed you the reason.</p>
          )}
        </Section>
        <ProfileChecklist items={checklist} left={left.length} />
      </div>
    );
  }

  const { waitingReply, stats, closedThisYear } = await proDashboard(pro.id, pro.leadCapPerDay);
  return (
    <div className="space-y-6">
      <h1 className="text-h1">Welcome, {pro.displayName.split(" ")[0]}</h1>

      <Section title="Leads waiting for your reply" testId="waiting-reply">
        {waitingReply.length === 0 ? (
          <p className="text-body text-neutral-600">Nothing waiting. New leads from Glowy Homes appear here and in your email.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {waitingReply.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.consumerName} · {TYPE[l.leadType] ?? l.leadType}</p>
                  <p className="truncate text-small text-neutral-600">
                    {l.address ?? "No home chosen yet"}
                    {l.assignedAt ? ` · assigned ${formatDate(l.assignedAt)}` : ""}
                  </p>
                </div>
                <Link href={`/pro/leads?lead=${l.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 font-medium text-accent hover:underline">
                  Reply <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Your numbers">
        {[
          ["New today", stats.newToday],
          ["Leads this month", stats.thisMonth],
          ["Typical reply", stats.medianResponse === null ? "None yet" : `${stats.medianResponse} min`],
          ["Closed this year", closedThisYear],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-neutral-200 bg-white p-4">
            <dt className="text-small text-neutral-600">{label}</dt>
            <dd className="tabular mt-1 text-h2">{value}</dd>
          </div>
        ))}
      </dl>

      <ProfileChecklist items={checklist} left={left.length} />
    </div>
  );
}

function ProfileChecklist({ items, left }: { items: ReturnType<typeof profileChecklist>; left: number }) {
  return (
    <Section title={left === 0 ? "Your profile is complete" : `Finish your profile: ${left} ${left === 1 ? "step" : "steps"} left`} testId="profile-checklist">
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.key} className="flex items-center gap-3 text-body">
            {c.done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden /> : <Circle className="size-5 shrink-0 text-neutral-400" aria-hidden />}
            {c.done ? (
              <span className="text-neutral-600">{c.label}<span className="sr-only">, done</span></span>
            ) : (
              <Link href={c.href} className="font-medium text-accent hover:underline">{c.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
