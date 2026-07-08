import { NextResponse } from 'next/server'

const API = 'https://api.github.com'
const API_VERSION = '2022-11-28'

function env(name) {
  return (process.env[name] || '').trim()
}

function repoLimit() {
  const value = Number(env('GITHUB_REPO_LIMIT') || 12)
  return Math.max(1, Math.min(50, Number.isFinite(value) ? value : 12))
}

function headers() {
  const token = env('GITHUB_TOKEN')
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function githubFetch(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: headers(),
    next: { revalidate: 60 },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()
    const error = new Error(text || response.statusText)
    error.status = response.status
    error.rateRemaining = response.headers.get('x-ratelimit-remaining')
    throw error
  }

  return {
    data: await response.json(),
    rateRemaining: response.headers.get('x-ratelimit-remaining'),
  }
}

async function githubFetchOptional(path, fallback) {
  try {
    return (await githubFetch(path)).data
  } catch {
    return fallback
  }
}

async function listOwnerRepos(owner) {
  const limit = repoLimit()
  const query = `sort=pushed&direction=desc&per_page=${limit}`
  const type = env('GITHUB_TOKEN') ? 'all' : 'public'

  try {
    return await githubFetch(`/orgs/${owner}/repos?type=${type}&${query}`)
  } catch (err) {
    if (err.status !== 404) throw err
    return githubFetch(`/users/${owner}/repos?type=${type === 'all' ? 'all' : 'owner'}&${query}`)
  }
}

function workflowStatus(run) {
  if (!run) return 'unknown'
  if (run.status && run.status !== 'completed') return 'pending'
  if (run.conclusion === 'success') return 'passing'
  if (['failure', 'cancelled', 'timed_out', 'action_required'].includes(run.conclusion)) return 'failing'
  return 'unknown'
}

function workflowLabel(status) {
  if (status === 'passing') return 'passing'
  if (status === 'failing') return 'failing'
  if (status === 'pending') return 'running'
  return 'unknown'
}

function shortSha(value) {
  return String(value || '').slice(0, 7)
}

function mapCommit(repo, commit) {
  const author = commit.author || {}
  return {
    id: `${repo.id}-${commit.sha}`,
    repoId: String(repo.id),
    repoName: repo.full_name,
    message: commit.commit?.message?.split('\n')[0] || 'Commit sin mensaje',
    sha: shortSha(commit.sha),
    url: commit.html_url,
    authorName: commit.commit?.author?.name || author.login || 'GitHub',
    authorAvatarUrl: author.avatar_url,
    createdAt: commit.commit?.author?.date,
  }
}

function mapPullRequest(repo, pull) {
  return {
    id: `${repo.id}-${pull.id}`,
    repoId: String(repo.id),
    repoName: repo.full_name,
    number: pull.number,
    title: pull.title,
    status: pull.draft ? 'draft' : 'open',
    url: pull.html_url,
    authorName: pull.user?.login || 'GitHub',
    authorAvatarUrl: pull.user?.avatar_url,
    additions: 0,
    deletions: 0,
    createdAt: pull.created_at,
  }
}

function mapWorkflow(repo, run) {
  const status = workflowStatus(run)
  return {
    id: `${repo.id}-${run.id}`,
    repoId: String(repo.id),
    repoName: repo.full_name,
    name: run.name || run.display_title || 'Workflow',
    status,
    branch: run.head_branch,
    duration: run.run_started_at && run.updated_at
      ? `${Math.max(1, Math.round((new Date(run.updated_at) - new Date(run.run_started_at)) / 60000))} min`
      : '',
    runAt: run.run_started_at || run.created_at,
    url: run.html_url,
  }
}

async function hydrateRepo(repo) {
  const [commits, pulls, runs, branches] = await Promise.all([
    githubFetchOptional(`/repos/${repo.full_name}/commits?per_page=5`, []),
    githubFetchOptional(`/repos/${repo.full_name}/pulls?state=open&per_page=10`, []),
    githubFetchOptional(`/repos/${repo.full_name}/actions/runs?per_page=5`, { workflow_runs: [] }),
    githubFetchOptional(`/repos/${repo.full_name}/branches?per_page=100`, []),
  ])

  const workflowRuns = runs.workflow_runs || []
  const latestRun = workflowRuns[0]
  const ci = workflowStatus(latestRun)

  return {
    repository: {
      id: String(repo.id),
      projectId: null,
      name: repo.full_name,
      description: repo.description,
      visibility: repo.private ? 'private' : 'public',
      language: repo.language || 'Sin lenguaje',
      stars: repo.stargazers_count || 0,
      openIssues: Math.max(0, (repo.open_issues_count || 0) - pulls.length),
      openPRs: pulls.length,
      lastCommit: repo.pushed_at,
      lastRelease: null,
      ci,
      branches: Array.isArray(branches) ? branches.length : 0,
      contributors: [],
      url: repo.html_url,
      homepage: repo.homepage,
      archived: repo.archived,
      defaultBranch: repo.default_branch,
    },
    commits: commits.map((commit) => mapCommit(repo, commit)),
    pullRequests: pulls.map((pull) => mapPullRequest(repo, pull)),
    workflows: workflowRuns.map((run) => mapWorkflow(repo, run)),
  }
}

export async function GET() {
  const owner = env('GITHUB_ORG')

  if (!owner) {
    return NextResponse.json(
      { error: 'Configura GITHUB_ORG en .env.local para activar la integracion.' },
      { status: 400 },
    )
  }

  try {
    const reposResponse = await listOwnerRepos(owner)
    const hydrated = await Promise.all(reposResponse.data.map(hydrateRepo))

    return NextResponse.json({
      owner,
      source: 'github',
      fetchedAt: new Date().toISOString(),
      rateRemaining: reposResponse.rateRemaining,
      repositories: hydrated.map((item) => item.repository),
      commits: hydrated.flatMap((item) => item.commits).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      pullRequests: hydrated.flatMap((item) => item.pullRequests).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      workflows: hydrated.flatMap((item) => item.workflows).sort((a, b) => new Date(b.runAt) - new Date(a.runAt)),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'No se pudo conectar con GitHub.',
        detail: err.message,
        rateRemaining: err.rateRemaining,
      },
      { status: err.status || 500 },
    )
  }
}
