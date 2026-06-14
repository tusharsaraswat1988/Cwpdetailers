import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import type { OperationalRoleSlug } from "@/lib/staff-ecosystem/roles";

type StaffOption = { id: number; name: string; employeeCode?: string | null };

type Props = {
  roleSlug: OperationalRoleSlug;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

export function StaffAssignSelect({
  roleSlug,
  value,
  onValueChange,
  placeholder = "Select staff",
  allowUnassigned = false,
  className,
  disabled,
  "data-testid": testId,
}: Props) {
  const { data: staff = [], isLoading } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "assign", roleSlug],
    queryFn: () => staffEcosystemApi.listStaffForAssignment(roleSlug),
  });

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || isLoading}>
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder={isLoading ? "Loading staff…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowUnassigned && <SelectItem value="none">Unassigned</SelectItem>}
        {(staff as StaffOption[]).map(s => (
          <SelectItem key={s.id} value={String(s.id)}>
            {s.name}{s.employeeCode ? ` · ${s.employeeCode}` : ""}
          </SelectItem>
        ))}
        {!isLoading && staff.length === 0 && (
          <SelectItem value="__empty" disabled>
            No staff with this operational role
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
