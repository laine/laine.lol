import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface TimeSeriesChartProps {
  data: { date: string; count: number }[];
}

const MAUVE = "#c77f81";
const MAUVE_FILL = "rgba(199, 127, 129, 0.15)";

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data for the selected time range
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="date"
            stroke="#888"
            tick={{ fill: "#888", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#555" }}
          />
          <YAxis
            stroke="#888"
            tick={{ fill: "#888", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#555" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1014",
              border: `1px solid ${MAUVE}`,
              borderRadius: "8px",
              color: "#e0e0e0",
              fontSize: 13,
            }}
            labelStyle={{ color: "#999" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={MAUVE}
            fill={MAUVE_FILL}
            strokeWidth={2}
            name="Pastes"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
