import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_SECTIONS,
  CUSTOMER_HUB_GROUP_ID,
  filterAdminNavSections,
  isAdminNavGroup,
  isAdminNavGroupActive,
  isAdminNavItemActive,
  type AdminNavGroup,
  type AdminNavItem,
} from "./adminNavConfig";

type Props = {
  onNavigate?: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  collapsed?: boolean;
};

function NavLink({
  item,
  active,
  onNavigate,
  nested = false,
  collapsed = false,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-testid={`nav-${item.id}`}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm transition-all group",
        nested ? "px-3 py-1.5 ml-2" : "px-3 py-2",
        active
          ? "bg-primary text-secondary font-semibold"
          : "text-white/60 hover:text-white hover:bg-white/5",
      )}
    >
      <Icon size={nested ? 14 : 15} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function NavGroup({
  group,
  location,
  expanded,
  onToggle,
  onNavigate,
  collapsed,
}: {
  group: AdminNavGroup;
  location: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = group.icon;
  const groupActive = isAdminNavGroupActive(location, group);

  if (collapsed) {
    const firstChild = group.children[0];
    if (!firstChild) return null;
    return (
      <NavLink
        item={{ ...firstChild, icon: Icon, label: group.label }}
        active={groupActive}
        onNavigate={onNavigate}
        collapsed
      />
    );
  }

  return (
    <div data-testid={`nav-group-${group.id}`}>
      <button
        type="button"
        onClick={onToggle}
        data-testid={`nav-${group.id}`}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
          groupActive
            ? "bg-white/10 text-white font-semibold"
            : "text-white/60 hover:text-white hover:bg-white/5",
        )}
      >
        <Icon size={15} className="flex-shrink-0" />
        <span className="truncate flex-1 text-left">{group.label}</span>
        <span className={cn("text-white/40 text-xs transition-transform", expanded && "rotate-90")}>›</span>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-white/10 ml-4 pl-1">
          {group.children.map(child => (
            <NavLink
              key={child.id}
              item={child}
              active={isAdminNavItemActive(location, child)}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminNavMenu({ onNavigate, hasPermission, collapsed = false }: Props) {
  const [location] = useLocation();
  const sections = filterAdminNavSections(ADMIN_NAV_SECTIONS, hasPermission);
  const hubActive = sections.some(section =>
    section.entries.some(
      entry => isAdminNavGroup(entry) && isAdminNavGroupActive(location, entry),
    ),
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    hubActive ? { [CUSTOMER_HUB_GROUP_ID]: true } : {},
  );

  useEffect(() => {
    if (hubActive) {
      setExpandedGroups(prev => ({ ...prev, [CUSTOMER_HUB_GROUP_ID]: true }));
    }
  }, [location, hubActive]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <>
      {sections.map(section => (
        <div key={section.label} className={collapsed ? "mb-2" : undefined}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 mb-1.5">
              <div className="w-0.5 h-3 rounded-full bg-primary/40 shrink-0" />
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">{section.label}</p>
            </div>
          )}
          <div className="space-y-0.5">
            {section.entries.map(entry => {
              if (isAdminNavGroup(entry)) {
                const expanded = expandedGroups[entry.id] ?? isAdminNavGroupActive(location, entry);
                return (
                  <NavGroup
                    key={entry.id}
                    group={entry}
                    location={location}
                    expanded={expanded}
                    onToggle={() => toggleGroup(entry.id)}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                );
              }
              return (
                <NavLink
                  key={entry.id}
                  item={entry}
                  active={isAdminNavItemActive(location, entry)}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
