// ── GitHub sync ────────────────────────────────────────
// The hosting disk is ephemeral: every deploy rebuilds it from the GitHub
// repo, wiping anything the admin panel saved (products, uploaded photos).
// This module mirrors every data change back to the repo via the GitHub
// Contents API, so the repo is always the source of truth and deploys can
// never lose products again.
//
// Setup: create a fine-grained personal access token with "Contents:
// Read and write" permission on the repo, and set it as GITHUB_TOKEN in
// the hosting dashboard. Without a token the module is inactive and the
// site behaves exactly as before (fine for local development).
//
// Commit messages include "[skip render]" so data commits do not trigger
// a pointless redeploy loop.

const fs = require('fs');

const TOKEN  = process.env.GITHUB_TOKEN  || '';
const REPO   = process.env.GITHUB_REPO   || 'infinitywomansgym/zaraya-clean';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API    = `https://api.github.com/repos/${REPO}/contents/`;

const enabled = !!TOKEN;

// All API calls run through one serial queue — GitHub rejects concurrent
// writes to the same branch, and order matters (e.g. upload then delete).
let queue = Promise.resolve();
function enqueue(label, fn) {
  if (!enabled) return;
  queue = queue.then(fn).catch(e => console.error(`[github-sync] ${label} failed: ${e.message}`));
}

function headers() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'zaraya-sync',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// Updating or deleting an existing file requires its current blob sha.
async function getSha(repoPath) {
  const res = await fetch(API + repoPath + `?ref=${BRANCH}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${repoPath} → HTTP ${res.status}`);
  const data = await res.json();
  return data.sha || null;
}

/** Mirror a local file into the repo. repoPath uses forward slashes. */
function pushFile(absPath, repoPath) {
  enqueue(`push ${repoPath}`, async () => {
    const content = fs.readFileSync(absPath).toString('base64');
    const sha = await getSha(repoPath);
    const res = await fetch(API + repoPath, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `admin: update ${repoPath} [skip render]`,
        content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });
    if (!res.ok) throw new Error(`PUT ${repoPath} → HTTP ${res.status} ${await res.text()}`);
  });
}

/** Remove a file from the repo (no-op if it isn't there). */
function deleteFile(repoPath) {
  enqueue(`delete ${repoPath}`, async () => {
    const sha = await getSha(repoPath);
    if (!sha) return;
    const res = await fetch(API + repoPath, {
      method: 'DELETE',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `admin: remove ${repoPath} [skip render]`,
        sha,
        branch: BRANCH
      })
    });
    if (!res.ok) throw new Error(`DELETE ${repoPath} → HTTP ${res.status}`);
  });
}

module.exports = { enabled, pushFile, deleteFile };
