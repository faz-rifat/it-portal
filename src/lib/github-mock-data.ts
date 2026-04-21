export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: { name: string; color: string }[];
}

export const MOCK_ISSUES: GitHubIssue[] = [
  {
    id: 1,
    number: 101,
    title: "Critical: Database connection timeout in production",
    state: "open",
    created_at: "2024-03-01T10:00:00Z",
    updated_at: "2024-03-02T12:00:00Z",
    body: "We are seeing intermittent connection timeouts in the production environment. This seems to be happening during peak hours. Preliminary logs suggest pool exhaustion. We need to investigate if we should increase the max connection limit or optimize existing queries.",
    user: {
      login: "dev-lead",
      avatar_url: "https://picsum.photos/seed/user1/100/100"
    },
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "critical", color: "b60205" }
    ]
  },
  {
    id: 2,
    number: 102,
    title: "Feature Request: Add dark mode toggle",
    state: "open",
    created_at: "2024-03-05T09:00:00Z",
    updated_at: "2024-03-05T09:00:00Z",
    body: "Users have been requesting a dark mode for better night-time usage. We should implement a theme switcher component using Tailwind CSS and local storage to persist the user's preference.",
    user: {
      login: "ux-designer",
      avatar_url: "https://picsum.photos/seed/user2/100/100"
    },
    labels: [
      { name: "enhancement", color: "a2eeef" },
      { name: "ui/ux", color: "fef2c0" }
    ]
  },
  {
    id: 3,
    number: 103,
    title: "Documentation: Update API reference for v2",
    state: "closed",
    created_at: "2024-02-15T14:00:00Z",
    updated_at: "2024-03-01T11:00:00Z",
    body: "The current documentation reflects the v1 API. We need to update all endpoints, request/response schemas, and examples to match the recently released v2 API version.",
    user: {
      login: "tech-writer",
      avatar_url: "https://picsum.photos/seed/user3/100/100"
    },
    labels: [
      { name: "documentation", color: "0075ca" }
    ]
  },
  {
    id: 4,
    number: 104,
    title: "Refactor: Modularize the authentication hook",
    state: "open",
    created_at: "2024-03-10T16:45:00Z",
    updated_at: "2024-03-11T08:20:00Z",
    body: "The current useAuth hook is getting too large. We should split it into smaller components: useUser, useLogin, useLogout for better maintainability and testing. This is purely internal refactoring to clean up the code base before the next major release.",
    user: {
      login: "senior-dev",
      avatar_url: "https://picsum.photos/seed/user4/100/100"
    },
    labels: [
      { name: "refactor", color: "d4c5f9" }
    ]
  }
];