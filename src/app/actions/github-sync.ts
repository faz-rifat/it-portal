'use server';

import { fetchGitHubProjectItems } from '@/lib/github-service';

/**
 * Fetches GitHub Project 181 items (existing — unchanged behaviour).
 */
export async function fetchGitHubIssuesAction(since?: string) {
  try {
    const items = await fetchGitHubProjectItems(181, since);
    return { success: true, items };
  } catch (error: any) {
    console.error("GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch data from GitHub" };
  }
}

/**
 * Fetches GitHub Project 358 (Workhub) items.
 */
export async function fetchWorkhubIssuesAction(since?: string) {
  try {
    const items = await fetchGitHubProjectItems(358, since);
    return { success: true, items };
  } catch (error: any) {
    console.error("Workhub GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch Workhub data from GitHub" };
  }
}

/**
 * Fetches GitHub Project 305 (Techsupport) items.
 */
export async function fetchTechsupportIssuesAction(since?: string) {
  try {
    const items = await fetchGitHubProjectItems(305, since);
    return { success: true, items };
  } catch (error: any) {
    console.error("Techsupport GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch Techsupport data from GitHub" };
  }
}
