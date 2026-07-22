import { z } from "zod";

export const criterionSchema = z.enum([
  // Identidad
  "face",
  "hair_color",
  "hair_type",
  "age",
  "identity_consistency",
  // Anatomía
  "hands",
  "fingers",
  "arms",
  "legs",
  "proportions",
  "silhouette",
  "posture",
  // Outfit
  "garments",
  "layering",
  "colors",
  "texture",
  "fit_on_body",
  "accessories",
  // Producto
  "product_identity",
  "product_quantity",
  "product_position",
  "product_orientation",
  // Escena
  "furniture",
  "decor",
  "duplications",
  "invented_objects",
  "continuity",
  // Calidad
  "ugc_style",
  "iphone_realism",
  "lighting",
  "composition",
  "narrative",
]);

export type Criterion = z.infer<typeof criterionSchema>;

export const findingSchema = z.object({
  shotId: z.string(),
  criterion: criterionSchema,
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  evidence: z.string(),
  probableCause: z.string(),
});

export type Finding = z.infer<typeof findingSchema>;

export const locatedFindingSchema = findingSchema.extend({
  recipeId: z.string().optional(),
  suspectFile: z.string().optional(),
  suspectLine: z.number().optional(),
  suspectSnippet: z.string().optional(),
  locatorConfidence: z.enum(["high", "medium", "low", "none"]),
  locatorNotes: z.string().optional(),
});

export type LocatedFinding = z.infer<typeof locatedFindingSchema>;

export type ShotEvaluation = {
  shotId: string;
  imageFile: string;
  score: number;
  status: "pass" | "review" | "fail";
  findings: Finding[];
};

export type TestReport = {
  testId: string;
  recipeId: string;
  evaluatedAt: string;
  score: number;
  status: "pass" | "review" | "fail";
  shots: ShotEvaluation[];
  locatedFindings: LocatedFinding[];
  summary: string;
};

export type ReferenceDescriptor = {
  hash: string;
  file: string;
  description: string;
  analyzedAt: string;
};

export type ReferenceIndex = Record<string, ReferenceDescriptor>;
