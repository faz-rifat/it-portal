'use server';

import { fetchGitHubProjectItems } from '@/lib/github-service';

/**
 * Fetches ALL items from GitHub Project 181 (Service Desk / L2).
 * Filtering to specific agents is done in the UI layer (page.tsx).
 */
export async function fetchGitHubIssuesAction() {
  try {
    const items = await fetchGitHubProjectItems(181);
    return { success: true, items };
  } catch (error: any) {
    console.error("GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch data from GitHub" };
  }
}

/**
 * Fetches ALL items from GitHub Project 358 (Workhub).
 */
export async function fetchWorkhubIssuesAction() {
  try {
    const items = await fetchGitHubProjectItems(358);
    return { success: true, items };
  } catch (error: any) {
    console.error("Workhub GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch Workhub data from GitHub" };
  }
}

/**
 * Fetches ALL items from GitHub Project 305 (Techsupport).
 */
export async function fetchTechsupportIssuesAction() {
  try {
    const items = await fetchGitHubProjectItems(305);
    return { success: true, items };
  } catch (error: any) {
    console.error("Techsupport GitHub Fetch Error:", error);
    return { success: false, error: error.message || "Failed to fetch Techsupport data from GitHub" };
  }
}