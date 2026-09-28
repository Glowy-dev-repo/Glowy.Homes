"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { primaryNav } from "@/config/nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { data } = useSession();
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
          <Menu className="size-5!" aria-hidden />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-raised focus:outline-none">
          <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
            <Dialog.Title className="text-h3">Menu</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X className="size-5!" aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-2 py-2">
            <ul>
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex min-h-12 items-center rounded-md px-3 text-body font-medium text-neutral-900 hover:bg-neutral-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-2 border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {data?.user ? (
              <Button asChild variant="secondary">
                <Link href="/account" onClick={close}>
                  Account
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/signin" onClick={close}>
                  Sign in
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/sell" onClick={close}>
                Thinking of selling?
              </Link>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
