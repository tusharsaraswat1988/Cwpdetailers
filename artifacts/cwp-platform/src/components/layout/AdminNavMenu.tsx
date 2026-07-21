import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_SECTIONS,
  LEGACY_GROUP_ID,
  filterAdminNavSections,
  isAdminNavGroup,
  isAdminNavGroupActive,
  isAdminNavItemActive,
  isAdminNavSectionActive,
  type AdminNavGroup,
  type AdminNavItem,
  type AdminNavSection,
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
          ? "bg-primary text-primary-foreground font-semibold"
          : "text-white/60 hover:text-white hover:bg-white/5",
      )}
    >
      <Icon size={nested ? 14 : 15} strokeWidth={1.75} className="flex-shrink-0" />
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
  variant,
}: {
  group: AdminNavGroup;
  location: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
  variant?: AdminNavSection["variant"];
}) {
  const Icon = group.icon;
  const groupActive = isAdminNavGroupActive(location, group);
  const isLegacy = variant === "legacy" || group.id === LEGACY_GROUP_ID;

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
            ? isLegacy
              ? "bg-amber-500/15 text-amber-100 font-semibold"
              : "bg-white/10 text-white font-semibold"
            : isLegacy
              ? "text-amber-200/70 hover:text-amber-100 hover:bg-amber-500/10"
              : "text-white/60 hover:text-white hover:bg-white/5",
        )}
      >
        <Icon size={15} strokeWidth={1.75} className="flex-shrink-0" />
        <span className="truncate flex-1 text-left">{group.label}</span>
        <span className={cn("text-white/40 text-xs transition-transform", expanded && "rotate-90")}>›</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {isLegacy && group.description && (
            <p className="text-[10px] text-amber-200/60 px-3 py-1.5 ml-2 border-l border-amber-500/30 leading-relaxed">
              ⚠ {group.description}
            </p>
          )}
          <div className="space-y-0.5 border-l border-white/10 ml-4 pl-1">
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
        </div>
      )}
    </div>
  );
}

function NavSection({
  section,
  location,
  collapsed,
  expandedGroups,
  expandedSections,
  onToggleGroup,
  onToggleSection,
  onNavigate,
}: {
  section: AdminNavSection;
  location: string;
  collapsed?: boolean;
  expandedGroups: Record<string, boolean>;
  expandedSections: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
  onToggleSection: (label: string) => void;
  onNavigate?: () => void;
}) {
  const sectionActive = isAdminNavSectionActive(location, section);
  const sectionExpanded = expandedSections[section.label] ?? !section.defaultCollapsed;
  const isLegacy = section.variant === "legacy";

  if (section.defaultCollapsed && !collapsed) {
    return (
      <div className="mb-1">
        <button
          type="button"
          onClick={() => onToggleSection(section.label)}
          className={cn(
            "w-full flex items-center gap-2 px-3 mb-1.5 rounded-md transition-colors",
            isLegacy && "hover:bg-amber-500/10",
          )}
        >
          <div className={cn("w-0.5 h-3 rounded-full shrink-0", isLegacy ? "bg-amber-500/60" : "bg-white/20")} />
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-widest flex-1 text-left",
            isLegacy ? "text-amber-300/80" : "text-white/35",
            sectionActive && (isLegacy ? "text-amber-200" : "text-white/55"),
          )}>
            {section.label}
          </p>
          <span className={cn("text-[10px] transition-transform", sectionExpanded && "rotate-90", isLegacy ? "text-amber-400/60" : "text-white/30")}>›</span>
        </button>
        {sectionExpanded && (
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
                    onToggle={() => onToggleGroup(entry.id)}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                    variant={section.variant}
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
        )}
      </div>
    );
  }

  return (
    <div className={collapsed ? "mb-2" : undefined}>
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
                onToggle={() => onToggleGroup(entry.id)}
                onNavigate={onNavigate}
                collapsed={collapsed}
                variant={section.variant}
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
  );
}

export function AdminNavMenu({ onNavigate, hasPermission, collapsed = false }: Props) {
  const [location] = useLocation();
  const sections = filterAdminNavSections(ADMIN_NAV_SECTIONS, hasPermission);

  const legacyActive = sections.some(section =>
    section.variant === "legacy" && isAdminNavSectionActive(location, section),
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => ({
    ...(legacyActive ? { [LEGACY_GROUP_ID]: true } : {}),
  }));

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({
    ...(legacyActive ? { Legacy: true } : {}),
  }));

  useEffect(() => {
    if (legacyActive) {
      setExpandedGroups(prev => ({ ...prev, [LEGACY_GROUP_ID]: true }));
      setExpandedSections(prev => ({ ...prev, Legacy: true }));
    }
  }, [location, legacyActive]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleSection = (label: string) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {sections.map(section => (
        <NavSection
          key={section.label}
          section={section}
          location={location}
          collapsed={collapsed}
          expandedGroups={expandedGroups}
          expandedSections={expandedSections}
          onToggleGroup={toggleGroup}
          onToggleSection={toggleSection}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}
