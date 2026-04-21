/**
 * @fileOverview Server-side utility for GitHub GraphQL API interactions.
 *
 * IMPORTANT: GITHUB_TOKEN is read from Environment Variables (.env.local / deployment env).
 */

const ORG_NAME = process.env.GITHUB_ORG ?? "SELISEdigitalplatforms";
const GRAPHQL_URL = "https://api.github.com/graphql";

export interface GitHubProjectItem {
  createdAt: string;
  content: {
    __typename: string;
    title: string;
    number: number;
    url: string;
    state: string;
    body: string;
    updatedAt: string;
    closed: boolean;
    author: { login: string } | null;
    assignees: { nodes: { login: string }[] };
    labels: { nodes: { name: string }[] };
    comments: {
      nodes: Array<{
        body: string;
        author: { login: string } | null;
        createdAt: string;
      }>;
    };
  } | null;
  fieldValues: {
    nodes: Array<{
      text?: string;
      date?: string;
      number?: number;
      name?: string;
      title?: string;
      users?: { nodes: { login: string }[] };
      field: { name: string };
    } | null>;
  };
}

/**
 * Fetches ALL items from a GitHub ProjectV2, paginating through every page.
 * @param projectNumber - The GitHub project number (e.g. 181, 358, 305)
 */
export async function fetchGitHubProjectItems(projectNumber: number = 181): Promise<GitHubProjectItem[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is missing. Please add your actual token to the environment variables."
    );
  }

  const itemFragment = `
    createdAt
    content {
      __typename
      ... on Issue {
        title number url state body updatedAt closed
        author { login }
        assignees(first: 10) { nodes { login } }
        labels(first: 20) { nodes { name } }
        comments(last: 1) {
          nodes { body createdAt author { login } }
        }
      }
      ... on PullRequest {
        title number url state body updatedAt
        closed: merged
        author { login }
        assignees(first: 10) { nodes { login } }
        labels(first: 20) { nodes { name } }
        comments(last: 1) {
          nodes { body createdAt author { login } }
        }
      }
    }
    fieldValues(first: 20) {
      nodes {
        ... on ProjectV2ItemFieldTextValue       { text   field { ... on ProjectV2Field          { name } } }
        ... on ProjectV2ItemFieldDateValue       { date   field { ... on ProjectV2Field          { name } } }
        ... on ProjectV2ItemFieldNumberValue     { number field { ... on ProjectV2Field          { name } } }
        ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
        ... on ProjectV2ItemFieldIterationValue  { title  field { ... on ProjectV2IterationField { name } } }
        ... on ProjectV2ItemFieldUserValue       { users(first: 1) { nodes { login } } field { ... on ProjectV2Field { name } } }
      }
    }
  `;

  const query = `
    query($org: String!, $number: Int!, $cursor: String) {
      organization(login: $org) {
        projectV2(number: $number) {
          items(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { ${itemFragment} }
          }
        }
      }
    }
  `;

  const allItems: GitHubProjectItem[] = [];
  let cursor: string | null = null;

  // Paginate until all items are fetched
  while (true) {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { org: ORG_NAME, number: projectNumber, cursor },
      }),
    });

    // Catch HTTP-level errors (401, 403, 5xx, etc.)
    if (!response.ok) {
      throw new Error(
        `GitHub API responded with HTTP ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GitHub GraphQL Error: ${JSON.stringify(result.errors)}`);
    }

    const page = result.data.organization.projectV2.items;
    allItems.push(...(page.nodes as GitHubProjectItem[]));

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  return allItems;
}
