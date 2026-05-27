"use client";
import { useEffect, useState } from "react";
import { fetchJSON, formatCurrency, formatMonth, Forecast } from "@/lib/data";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";

export default function ForecastView() {
  const [forecast, setForecast] = useState<Forecast | null>(null);

  useEffect(() => {
    fetchJSON<Forecast>("forecast.json").then(setForecast);
  }, []);

  if (!forecast) return <div className="vela-text-muted animate-pulse">Loading forecast...</div>;

  const chartData = [
    { month: "Now", projected_net_worth: forecast.starting_net_worth },
    ...forecast.months.map((m) => ({
      month: formatMonth(m.month),
      projected_net_worth: m.projected_net_worth,
    })),
  ];

  const endNW = forecast.months[forecast.months.length - 1].projected_net_worth;
  const gain = endNW - forecast.starting_net_worth;
  const monthlySavings = forecast.monthly_income - forecast.monthly_fixed_expenses - forecast.monthly_variable_avg;
  const savingsRate = Math.round((monthlySavings / forecast.monthly_income) * 100);

  return (
    <div className="space-y-8">
      <div>
        <p className="vela-text-muted text-sm">If things keep going the way they're going...</p>
        <h2 className="text-3xl font-bold vela-text-primary mt-1">What the Future Looks Like</h2>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Today's Net Worth" value={formatCurrency(forecast.starting_net_worth)} sub="current baseline" />
        <MetricCard label="In 12 Months" value={formatCurrency(endNW)} sub={`+${formatCurrency(gain)} projected`} highlight="vela-text-success" />
        <MetricCard label="Monthly Savings" value={formatCurrency(monthlySavings)} sub={`after all expenses`} />
        <MetricCard label="Savings Rate" value={`${savingsRate}%`} sub="of gross income" highlight={savingsRate >= 20 ? "vela-text-success" : "vela-text-warning"} />
      </div>

      {/* Forecast chart */}
      <div className="vela-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold vela-text-secondary mb-1">Projected Net Worth</h3>
        <p className="text-xs vela-text-muted mb-4">Based on current income, fixed costs, average variable spending, and ~6.6% annualized investment return</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false} tickLine={false} width={60}
            />
            <Tooltip
              formatter={(v: any) => [formatCurrency(Number(v)), "Projected Net Worth"]}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <ReferenceLine x="Now" stroke="#6366f1" strokeDasharray="4 4" label={{ value: "Today", fill: "#6366f1", fontSize: 11 }} />
            <Area type="monotone" dataKey="projected_net_worth" stroke="#10b981" strokeWidth={2} fill="url(#fcGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly assumptions */}
      <div className="vela-bg-surface rounded-2xl p-6 border">
        <h3 className="text-sm font-semibold vela-text-secondary mb-4">Monthly Assumptions</h3>
        <div className="space-y-3">
          {[
            { label: "Monthly Income", value: forecast.monthly_income, color: "vela-text-success" },
            { label: "Fixed Expenses (mortgage, loans, subscriptions)", value: -forecast.monthly_fixed_expenses, color: "vela-text-danger" },
            { label: "Variable Expenses (groceries, dining, shopping)", value: -forecast.monthly_variable_avg, color: "vela-text-warning" },
            { label: "Net Monthly Cash Flow", value: monthlySavings, color: monthlySavings >= 0 ? "vela-text-success" : "vela-text-danger" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b vela-border-subtle last:border-0">
              <span className="text-sm vela-text-secondary">{label}</span>
              <span className={`text-sm font-semibold ${color}`}>
                {value >= 0 ? "" : "−"}{formatCurrency(Math.abs(value))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs vela-text-muted mt-4">
          * Investment accounts grow at an assumed 6.6% annual return (~0.55%/mo). Adjust assumptions when you connect real data.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: string;
}) {
  return (
    <div className="vela-bg-surface rounded-2xl p-5 border">
      <p className="text-xs vela-text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${highlight ?? "vela-text-primary"}`}>{value}</p>
      <p className="text-xs vela-text-faint mt-1">{sub}</p>
    </div>
  );
}
