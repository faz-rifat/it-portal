/**
 * @fileOverview Server-side utility for GitHub GraphQL API interactions.
 * 
 * IMPORTANT: GITHUB_TOKEN is read from Environment Variables (.env).
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ORG_NAME = "SELISEdigitalplatforms";
const PROJECT_NUMBER = 181;
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
 * Fetches GitHub Project items from the specified organization and project number.
 */
export async function fetchGitHubProjectItems(since?: string) {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is missing. Please add your actual token to the environment variables.");
  }

  const query = `
    query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          items(last: 100) {
            nodes {
              createdAt
              content {
                __typename
                ... on Issue {
                  title number url state body updatedAt closed
                  author { login }
                  assignees(first: 10) { nodes { login } }
                  labels(first: 20) { nodes { name } }
                  comments(last: 1) {
                    nodes {
                      body
                      createdAt
                      author { login }
                    }
                  }
                }
                ... on PullRequest {
                  title number url state body updatedAt
                  author { login }
                  assignees(first: 10) { nodes { login } }
                  labels(first: 20) { nodes { name } }
                  comments(last: 1) {
                    nodes {
                      body
                      createdAt
                      author { login }
                    }
                  }
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
                  ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2IterationField { name } } }
                  ... on ProjectV2ItemFieldUserValue { users(first: 1) { nodes { login } } field { ... on ProjectV2Field { name } } }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { org: ORG_NAME, number: PROJECT_NUMBER },
    }),
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GitHub GraphQL Error: ${JSON.stringify(result.errors)}`);
  }

  const items: GitHubProjectItem[] = result.data.organization.projectV2.items.nodes;
  return items;
}
