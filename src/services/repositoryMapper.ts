import type { Repository } from '../../../src/types/auth';
import type { ListReposResponse } from '../types/github';

export class RepositoryMapper {
  static toRepository(repo: ListReposResponse): Repository {
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      owner: {
        id: repo.owner.id,
        login: repo.owner.login,
        name: repo.owner.name || null,
        avatarUrl: repo.owner.avatar_url,
        url: repo.owner.html_url,
        type: repo.owner.type as 'User' | 'Organization'
      },
      url: repo.html_url,
      gitUrl: repo.git_url,
      sshUrl: repo.ssh_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      visibility: repo.visibility as 'public' | 'private' | 'internal',
      createdAt: repo.created_at || '',
      updatedAt: repo.updated_at || '',
      pushedAt: repo.pushed_at || '',
      isPrivate: repo.private,
      isFork: repo.fork,
      permissions: {
        admin: repo.permissions?.admin || false,
        maintain: repo.permissions?.maintain,
        push: repo.permissions?.push || false,
        triage: repo.permissions?.triage,
        pull: repo.permissions?.pull || false,
      },
      topics: repo.topics || [],
      language: repo.language,
      size: repo.size
    };
  }
} 