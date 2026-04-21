
'use server';

import { fetchGitHubProjectItems } from '@/lib/github-service';

/**
 * Fetches GitHub Project 181 items from the GitHub GraphQL API.
 * This is a server action that only returns data to the client.
 * @param since Optional ISO date string to filter items.
 */
export async function fetchGitHubIssuesAction(since?: string) {
  try {
    const items = await fetchGitHubProjectItems(since);
    return { success: true, items };
  } catch (error: any) {
    console.error("GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch data from GitHub" };
  }
}
