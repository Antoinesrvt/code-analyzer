import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { components } from '@octokit/openapi-types';

// Get the exact types from the endpoints
type RepoResponse = RestEndpointMethodTypes['repos']['listForAuthenticatedUser']['response']['data'][number];
type SearchResponse = RestEndpointMethodTypes['search']['repos']['response']['data']['items'][number];

// API Response Types
export type GitHubUser = RestEndpointMethodTypes['users']['getAuthenticated']['response']['data'];

// Use more specific types from OpenAPI types
export type GitHubOwner = NonNullable<components['schemas']['simple-user']>;
export type GitHubRepository = components['schemas']['repository'];

// Ensure owner is non-null
export type ListReposResponse = Omit<RepoResponse, 'owner'> & {
  owner: NonNullable<RepoResponse['owner']>;
};

export type SearchReposResponse = Omit<SearchResponse, 'owner'> & {
  owner: NonNullable<SearchResponse['owner']>;
};

// Parameter Types
export type ListReposParameters = RestEndpointMethodTypes['repos']['listForAuthenticatedUser']['parameters'];
export type SearchReposParameters = RestEndpointMethodTypes['search']['repos']['parameters'];

// Type guard for repository permissions
export function hasRepositoryPermissions(repo: GitHubRepository): repo is GitHubRepository & { permissions: NonNullable<GitHubRepository['permissions']> } {
  return repo.permissions !== undefined;
}