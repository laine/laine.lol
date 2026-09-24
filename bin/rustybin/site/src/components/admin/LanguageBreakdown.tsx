import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface LanguageBreakdownProps {
  data: Record<string, number>;
}

const COLORS = [
  "#c77f81",
  "#ff8fc1",
  "#d84d86",
  "#139a65",
  "#3b82f6",
  "#a855f7",
  "#eab308",
  "#22d3ee",
];

export function LanguageBreakdown({ data }: LanguageBreakdownProps) {
  const entries = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No language data available
      </div>
    );
  }

  // Show top 7 + aggregate the rest as "Other"
  const top = entries.slice(0, 7);
  const rest = entries.slice(7);
  const chartData =
    rest.length > 0
      ? [
          ...top,
          { name: "Other", value: rest.reduce((s, e) => s + e.value, 0) },
        ]
      : top;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            dataKey="value"
            nameKey="name"
            strokeWidth={0}
          >
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1014",
              border: "1px solid #20222a",
              borderRadius: "8px",
              color: "#e0e0e0",
              fontSize: 13,
            }}
          />
          <Legend
            wrapperStyle={{ color: "#999", fontSize: 12 }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
