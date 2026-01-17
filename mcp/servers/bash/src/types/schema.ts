import { z } from "zod/v4";

export const BashRequestSchema = z.object({
  command: z.string().optional().describe("The bash command to be executed."),
  restart: z
    .boolean()
    .optional()
    .describe(
      "When true, the bash session will be restarted. Any provided commands will be ignored."
    ),
  stop: z
    .boolean()
    .optional()
    .describe(
      "When true, the bash session will be stopped. Any provided commands will be executed before the session is stopped."
    ),
});
export type BashRequest = z.infer<typeof BashRequestSchema>;

export const BashResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});
export type BashResponse = z.infer<typeof BashResponseSchema>;

export const BashSessionResultSchema = z.object({
  output: z.string().optional().describe("The output of the command."),
  errorOutput: z
    .string()
    .optional()
    .describe("The error output of the command."),
});
export type BashSessionResult = z.infer<typeof BashSessionResultSchema>;
