"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlayerRadar({
  playerName,
  scores,
  caption,
}: {
  playerName: string;
  scores: { technical: number; tactical: number; physical: number; mental: number };
  caption?: string;
}) {
  const chartData = [
    { metric: "Technical", score: scores.technical },
    { metric: "Tactical", score: scores.tactical },
    { metric: "Physical", score: scores.physical },
    { metric: "Mental", score: scores.mental },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Development radar</CardTitle>
        <CardDescription className="text-slate-700">
          {caption ?? `Latest scores for ${playerName}. Scale is 1 to 10.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="72%">
              <PolarGrid stroke="#aeb9c7" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#0b1b33", fontSize: 13, fontWeight: 700 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "#5b677a", fontSize: 11 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#0f766e"
                fill="#14b8a6"
                fillOpacity={0.45}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {chartData.map((item) => (
            <div key={item.metric} className="rounded-lg bg-slate-100 px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.metric}</dt>
              <dd className="text-2xl font-bold text-slate-950">{item.score}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
