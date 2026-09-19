import { z } from "zod";

export const criterionSchema = z.enum([
  "identity",
  "body",
  "hair",
  "outfit",
  "anatomy",
  "scene",
  "objects",
  "pose",
  "iphone_realism",
  "continuity",
  "story",
]);

export const shotSchema = z.object({
  id: z.string().min(1),
  image: z.string().min(1),
  prompt: z.string().default(""),
  objective: z.string().default(""),
  references: z.array(z.string()).default([]),
});

export const jobSchema = z.object({
  id: z.string().min(1),
  recipeId: z.string().min(1),
  recipeName: z.string().min(1),
  brief: z.string().default(""),
  criteria: z.array(criterionSchema).default(criterionSchema.options),
  globalReferences: z.array(z.string()).default([]),
  shots: z.array(shotSchema).min(1),
  thresholds: z.object({
    pass: z.number().min(0).max(100).default(82),
    critical: z.number().min(0).max(100).default(55),
  }).default({ pass: 82, critical: 55 }),
});

export type QaJob = z.infer<typeof jobSchema>;
export type Criterion = z.infer<typeof criterionSchema>;

export type Finding = {
  criterion: Criterion;
  score: number;
  severity: "info" | "warning" | "critical";
  title: string;
  evidence: string;
  probableCause: string;
  correction: string;
};

export type ShotReport = {
  shotId: string;
  score: number;
  status: "pass" | "review" | "fail";
  findings: Finding[];
};

export type QaReport = {
  jobId: string;
  recipeId: string;
  createdAt: string;
  score: number;
  status: "pass" | "review" | "fail";
  shots: ShotReport[];
  sequenceFindings: Finding[];
  summary: string;
};
