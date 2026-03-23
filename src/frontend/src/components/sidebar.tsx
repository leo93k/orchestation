"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Calendar,
  DollarSign,
  FileText,
  SquareTerminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  disabled: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Task",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
    href: "/",
    disabled: false,
  },
  {
    label: "Terminal",
    icon: <SquareTerminal className="h-3.5 w-3.5" />,
    href: "/terminal",
    disabled: false,
  },
  {
    label: "Sprint",
    icon: <Calendar className="h-3.5 w-3.5" />,
    href: "/sprint",
    disabled: false,
  },
  {
    label: "Plan",
    icon: <FileText className="h-3.5 w-3.5" />,
    href: "/plan",
    disabled: false,
  },
  {
    label: "Cost",
    icon: <DollarSign className="h-3.5 w-3.5" />,
    href: "/cost",
    disabled: false,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 py-3">
        <h1 className="text-sm font-semibold text-sidebar-foreground">
          Dashboard
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if (item.disabled) {
            return (
              <span
                key={item.label}
                className={cn(
                  buttonVariants({
                    variant: "sidebarDisabled",
                    size: "sidebar",
                  }),
                  "pointer-events-none text-xs",
                )}
                aria-disabled="true"
              >
                {item.icon}
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                buttonVariants({
                  variant: isActive ? "sidebarActive" : "sidebar",
                  size: "sidebar",
                }),
                "text-xs",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
