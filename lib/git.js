// Code-host integrations: GitHub (Octokit) and GitLab (Gitbeaker), both reduced to one list of items so the screens never care which one it came from.
// An item: { kind: 'review' | 'mine' | 'issue' | 'todo', title, repo, url, at, ci: 'ok' | 'fail' | 'run' | null }
//   review = a pull/merge request waiting for your review, mine = one of yours (with its CI), issue = assigned to you, todo = a notification / to-do.
// One account = { kind: 'github' | 'gitlab', host, token }. A failure is a code the screens can word: 'invalid' (token expired or revoked), 'forbidden', 'offline', 'timeout' or the service's own message.
const LIMIT = 15, TIMEOUT = 15000
const URLS = { github: 'https://github.com', gitlab: 'https://gitlab.com' }
const KINDS = Object.keys(URLS)

// "github.com", "https://gitlab.example.com/" -> "https://gitlab.example.com"; http:// only when allowHttp (the self test's fake server); anything else is refused
function normalizeHost(kind, input, allowHttp = false) {
  const s = String(input || '').trim() || URLS[kind]
  let u; try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s) } catch { return null }
  if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:') || u.username || u.password || u.search || u.hash) return null
  return u.origin + u.pathname.replace(/\/+$/, '')
}
const withTimeout = p => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Object.assign(new Error('timeout'), { code: 'timeout' })), TIMEOUT))])
const status = e => e?.status ?? e?.cause?.response?.status
function failure(e) {
  const s = status(e)
  if (s === 401 || /unauthorized|bad credentials/i.test(e?.message)) return 'invalid'
  if (s === 403 && !/rate limit/i.test(e?.message)) return 'forbidden'
  if (e?.code === 'timeout') return 'timeout'
  if (s === 403 || s === 429) return 'Rate limit reached, it will retry later'
  if (!s) return 'offline'
  return String(e?.message || 'Unknown error').slice(0, 160)
}
const ORDER = { review: 0, issue: 1, todo: 2, mine: 3 }
const rank = i => ORDER[i.kind]
const done = items => items.filter(i => i.url).sort((a, b) => rank(a) - rank(b) || new Date(b.at) - new Date(a.at))

// ---- GitHub: one GraphQL call (reviews, own pull requests with their CI, issues) + the notifications ----
const PR = 'title url updatedAt repository { nameWithOwner } commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }'
const QUERY = `query { viewer { login }
  review: search(query: "is:pr is:open review-requested:@me archived:false sort:updated-desc", type: ISSUE, first: ${LIMIT}) { nodes { ... on PullRequest { ${PR} } } }
  mine: search(query: "is:pr is:open author:@me archived:false sort:updated-desc", type: ISSUE, first: ${LIMIT}) { nodes { ... on PullRequest { ${PR} } } }
  issue: search(query: "is:issue is:open assignee:@me archived:false sort:updated-desc", type: ISSUE, first: ${LIMIT}) { nodes { ... on Issue { title url updatedAt repository { nameWithOwner } } } } }`
const GH_CI = { SUCCESS: 'ok', FAILURE: 'fail', ERROR: 'fail', PENDING: 'run', EXPECTED: 'run' }
async function github({ host, token }) {
  const { Octokit } = await import('@octokit/rest')
  const api = new Octokit({ auth: token, baseUrl: host === URLS.github ? 'https://api.github.com' : host + '/api/v3', userAgent: 'Heliarc' })
  const d = await withTimeout(api.graphql(QUERY))
  const items = ['review', 'mine', 'issue'].flatMap(kind => d[kind].nodes.filter(Boolean).map(n => ({ kind, title: n.title, repo: n.repository.nameWithOwner, url: n.url, at: n.updatedAt, ci: kind === 'mine' ? GH_CI[n.commits?.nodes?.[0]?.commit.statusCheckRollup?.state] || null : null })))
  try { // a token without the notifications permission still works for the rest
    const { data } = await withTimeout(api.rest.activity.listNotificationsForAuthenticatedUser({ per_page: LIMIT }))
    for (const n of data) {
      const web = n.subject.url?.replace(/^https?:\/\/[^/]+(\/api\/v3)?\/repos\//, host + '/').replace('/pulls/', '/pull/') || host + '/' + n.repository.full_name
      items.push({ kind: 'todo', title: n.subject.title, repo: n.repository.full_name, url: web, at: n.updated_at, ci: null })
    }
  } catch (e) { if (failure(e) === 'invalid') throw e }
  return { login: d.viewer.login, items }
}

// ---- GitLab: the same four lists through its REST API ----
const GL_CI = { success: 'ok', failed: 'fail', canceled: 'fail', running: 'run', pending: 'run', created: 'run', preparing: 'run', waiting_for_resource: 'run', scheduled: 'run' }
async function gitlab({ host, token }) {
  const { Gitlab } = await import('@gitbeaker/rest')
  const api = new Gitlab({ host, token }), page = { perPage: LIMIT, maxPages: 1, showExpanded: false }
  const me = await withTimeout(api.Users.showCurrentUser())
  const [review, mine, issue, todo] = await withTimeout(Promise.all([
    api.MergeRequests.all({ ...page, scope: 'all', state: 'opened', reviewerUsername: me.username }),
    api.MergeRequests.all({ ...page, scope: 'created_by_me', state: 'opened' }),
    api.Issues.all({ ...page, scope: 'assigned_to_me', state: 'opened' }),
    api.TodoLists.all({ ...page, state: 'pending' }),
  ]))
  const repo = x => x.references?.full?.replace(/[!#]\d+$/, '') || x.project?.path_with_namespace || ''
  const items = [['review', review], ['mine', mine], ['issue', issue]].flatMap(([kind, list]) => list.map(x => ({ kind, title: x.title, repo: repo(x), url: x.web_url, at: x.updated_at, ci: kind === 'mine' ? GL_CI[x.head_pipeline?.status] || null : null })))
  items.push(...todo.map(t => ({ kind: 'todo', title: t.body, repo: t.project?.path_with_namespace || '', url: t.target_url, at: t.updated_at, ci: null })))
  return { login: me.username, items }
}

// Reads everything an account has for you. { login, items } or { error: <failure code> }
async function fetchItems(account) {
  try { const r = await (account.kind === 'gitlab' ? gitlab : github)(account); return { login: r.login, items: done(r.items) } } catch (e) { console.warn('git:', account.kind, e?.name, e?.message?.slice(0, 120), e?.cause?.message?.slice(0, 80) || ''); return { error: failure(e) } }
}
module.exports = { KINDS, URLS, normalizeHost, fetchItems, rank }
