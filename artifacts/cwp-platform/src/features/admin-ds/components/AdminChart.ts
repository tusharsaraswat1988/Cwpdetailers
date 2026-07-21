/**
 * Recharts helpers — pages must import chart colors from here.
 */
import { ADMIN_CHART, ADMIN_CHART_COLORS } from "../tokens";

export { ADMIN_CHART, ADMIN_CHART_COLORS };

export function adminChartColor(index: number): string {
  return ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length]!;
}

export const adminChartTooltipStyle = {
  backgroundColor: ADMIN_CHART.tooltipBg,
  borderColor: ADMIN_CHART.tooltipBorder,
  borderRadius: 8,
  fontSize: 12,
} as const;

export const adminChartAxisProps = {
  stroke: ADMIN_CHART.axis,
  fontSize: 11,
  tickLine: false as const,
  axisLine: false as const,
};
