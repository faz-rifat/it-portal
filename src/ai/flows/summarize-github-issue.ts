'use server';
/**
 * @fileOverview An AI agent to summarize GitHub issue descriptions.
 *
 * - summarizeGithubIssue - A function that handles the GitHub issue summarization process.
 * - SummarizeGithubIssueInput - The input type for the summarizeGithubIssue function.
 * - SummarizeGithubIssueOutput - The return type for the summarizeGithubIssue function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeGithubIssueInputSchema = z.object({
  description: z
    .string()
    .describe('The full description of the GitHub issue to be summarized.'),
});
export type SummarizeGithubIssueInput = z.infer<
  typeof SummarizeGithubIssueInputSchema
>;

const SummarizeGithubIssueOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the GitHub issue.'),
});
export type SummarizeGithubIssueOutput = z.infer<
  typeof SummarizeGithubIssueOutputSchema
>;

export async function summarizeGithubIssue(
  input: SummarizeGithubIssueInput
): Promise<SummarizeGithubIssueOutput> {
  return summarizeGithubIssueFlow(input);
}

const summarizeGithubIssuePrompt = ai.definePrompt({
  name: 'summarizeGithubIssuePrompt',
  input: {schema: SummarizeGithubIssueInputSchema},
  output: {schema: SummarizeGithubIssueOutputSchema},
  prompt: `You are an AI assistant specialized in summarizing technical content, specifically GitHub issue descriptions.
Your goal is to provide a concise, clear, and actionable summary of the provided issue description.
Focus on the core problem, key details, and any proposed solutions or next steps.

Issue Description: {{{description}}}`,
});

const summarizeGithubIssueFlow = ai.defineFlow(
  {
    name: 'summarizeGithubIssueFlow',
    inputSchema: SummarizeGithubIssueInputSchema,
    outputSchema: SummarizeGithubIssueOutputSchema,
  },
  async input => {
    const {output} = await summarizeGithubIssuePrompt(input);
    return output!;
  }
);
