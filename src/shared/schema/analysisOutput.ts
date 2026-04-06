import { z } from "zod";

/** Matches the required app output: array of timed segments. */
export const analysisSegmentSchema = z.object({
  start: z
    .string()
    .describe("Start timestamp as mm:ss (minutes may be one or more digits)."),
  end: z.string().describe("End timestamp as mm:ss."),
  section: z.string().describe("Section title or label."),
  text: z
    .string()
    .describe("Transcript or caption text; may contain \\n line breaks."),
  pause: z.string().describe('Pause after segment, e.g. "0.0s" or "1.5s".'),
});

export const analysisOutputSchema = z.array(analysisSegmentSchema);

export type AnalysisSegment = z.infer<typeof analysisSegmentSchema>;
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
