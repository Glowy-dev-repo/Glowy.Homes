"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { LeadType } from "@/db/schema/leads";
import { cn } from "@/lib/utils";
import { LeadForm } from "./LeadForm";

const TITLES: Partial<Record<LeadType, string>> = {
  tour: "Request a tour",
  contact: "Contact an agent",
  rental_inquiry: "Ask about this rental",
  preapproval: "Get preapproved",
};

/** A lead form in a dialog, opened from the LDP actions and the mobile sticky bar. */
export function LeadDialog({
  leadType,
  trigger,
  triggerClassName,
  listingId,
  proId,
  address,
}: {
  leadType: LeadType;
  trigger: React.ReactNode;
  triggerClassName?: string;
  listingId?: string;
  proId?: string;
  address?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={cn(triggerClassName)}>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-lg bg-white p-6 shadow-raised sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-h2">{TITLES[leadType] ?? "Contact"}</Dialog.Title>
              {address && <Dialog.Description className="mt-1 text-small text-neutral-600">{address}</Dialog.Description>}
              {!address && <Dialog.Description className="sr-only">Send your details to a local professional</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-neutral-100" aria-label="Close">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <LeadForm leadType={leadType} listingId={listingId} proId={proId} address={address} onDone={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
