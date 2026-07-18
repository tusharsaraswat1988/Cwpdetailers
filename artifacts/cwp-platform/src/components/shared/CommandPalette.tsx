import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth";
import {
  ADMIN_NAV_SECTIONS,
  isAdminNavGroup,
  type AdminNavItem,
} from "@/components/layout/adminNavConfig";

type SearchableEntry = AdminNavItem & { sectionLabel: string };

function flattenNav(hasPermission: (resource: string, action: string) => boolean): SearchableEntry[] {
  const out: SearchableEntry[] = [];
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const entry of section.entries) {
      if (isAdminNavGroup(entry)) {
        for (const child of entry.children) {
          if (child.perm && !hasPermission(child.perm.resource, child.perm.action)) continue;
          out.push({ ...child, sectionLabel: section.label });
        }
      } else {
        if (entry.perm && !hasPermission(entry.perm.resource, entry.perm.action)) continue;
        out.push({ ...entry, sectionLabel: section.label });
      }
    }
  }
  return out;
}

/**
 * Global Ctrl+K / Cmd+K command palette — foundation for admin-wide search.
 * Today it searches navigable admin destinations; deeper record search
 * (customers, bookings, invoices…) can be layered in later without changing
 * this shell. Mount once near the root of the admin layout.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { hasPermission } = useAuth();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const entries = useMemo(() => flattenNav(hasPermission), [hasPermission]);
  const grouped = useMemo(() => {
    const map = new Map<string, SearchableEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.sectionLabel) ?? [];
      list.push(entry);
      map.set(entry.sectionLabel, list);
    }
    return Array.from(map.entries());
  }, [entries]);

  const go = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search admin pages… (Ctrl+K)" data-testid="command-palette-input" />
      <CommandList>
        <CommandEmpty>No matching pages.</CommandEmpty>
        {grouped.map(([label, items]) => (
          <CommandGroup key={label} heading={label}>
            {items.map(item => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  value={`${label} ${item.label}`}
                  onSelect={() => go(item.href)}
                  data-testid={`command-item-${item.id}`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
