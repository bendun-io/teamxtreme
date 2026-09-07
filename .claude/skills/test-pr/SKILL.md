---
name: test-pr
description: Locally run the test suite against an open pull request, check whether the changed code is actually exercised by tests, add and commit new test cases to the PR if it isn't, and give an explicit merge / do-not-merge recommendation. Use when asked to test a PR, vet a PR before merging, or check a PR's test coverage.
---

# Test a pull request

This repo's CI (`.github/workflows/tests.yml`) doesn't run for every PR
automatically — e.g. Dependabot PRs regularly sit with zero checks (see the
repo's Actions settings). This skill is the manual backstop: check out a PR,
actually run the real test suite (`tests/`, against the real Express app and
disposable Postgres/ClamAV containers — see
[tests/README.md](../../../tests/README.md)), verify the changed code is
exercised, and produce a recommendation the user can act on.

## 1. Identify the PR

If the user already named a PR (number, branch, or URL), use it directly.
Otherwise run `gh pr list --state open` and show the list via
AskUserQuestion (title + author + branch) so the user picks one — don't
guess which PR they mean.

Once chosen, capture:
- PR number and head branch (`gh pr view <n> --json number,headRefName,baseRefName,author,title`)
- The base branch to diff against (normally `master`)

## 2. Protect the user's working tree

Run `git status`. If there are uncommitted changes, stash them
(`git stash push -u -m "test-pr: pre-checkout stash"`) rather than
discarding anything, and note that you did so — you'll pop it back at the
end. Record the current branch name so you can return to it afterward.

Then check out the PR: `gh pr checkout <n>`.

## 3. Run the real test suite

Follow [tests/README.md](../../../tests/README.md):

- `cd src/backend && npm install` if `node_modules` is missing/stale
  (the tests import `src/backend/src/app.js` and its `db/*` modules
  directly).
- `cd tests && npm install` if its `node_modules` is missing/stale.
- `npm test` from `tests/` — this brings up the disposable
  `postgres-test`/`clamav-test` containers via `pretest` and runs every
  `*.test.js` under `api/` and `security/` with Node's built-in test
  runner.

Capture the full pass/fail result. If a video-thumbnail-related test
behaves differently than expected, check whether `ffmpeg` is installed
locally first — per
[Architecture.md#media-thumbnails](../../../docs/Architecture.md#media-thumbnails)
its absence is handled gracefully (thumbnail stays `NULL`) rather than
failing loudly, but it does mean that code path won't be truly exercised
locally without it.

Don't tear down the containers yet — step 5 reuses them.

## 4. Find what the PR actually changed

Get the changed files and line-level diff against the base branch:

```
gh pr diff <n> --name-only
git diff origin/<base>...HEAD
```

Separate this into:
- **Backend source** (`src/backend/src/**`, excluding tests) — this repo's
  automated tests can actually exercise this.
- **Frontend source** (`src/frontend/src/**`) — there is currently no
  automated test suite for the frontend in this repo; say so plainly in the
  final recommendation rather than implying it was checked.
- **Everything else** (docs, config, CI, migrations) — note migrations
  specifically, since `tests/helpers/server.js` running against a fresh
  test DB is itself a decent signal a new migration at least applies
  cleanly.

## 5. Check whether the changed backend code is actually exercised

Re-run the backend suite with Node's built-in coverage (no new dependency
needed):

```
cd tests && node --env-file=.env.test --test --experimental-test-coverage --test-concurrency=1
```

For each changed backend source file from step 4:
- If it doesn't appear in the coverage report at all, it's never imported/
  executed by any test — flag it.
- If it appears but the report's uncovered line ranges overlap the lines
  actually touched by the diff, flag those specific lines — a file with
  decent overall coverage can still leave the new code untouched.

## 6. Close real gaps with new tests

For each flagged gap, write test cases that exercise the changed behavior,
following the existing conventions exactly (real app + real Postgres/
ClamAV, no mocking, `node:test` + `assert`, one file per resource under
`api/` or the relevant file under `security/` — see
[tests/README.md](../../../tests/README.md#structure) and the existing
`*.test.js` files for the pattern). Prefer extending an existing file for
the resource over creating a new one.

Re-run `npm test` (and the coverage command) to confirm: the new tests
pass, and the previously-flagged lines are now covered.

If nothing was flagged in step 5, skip straight to step 8 — don't invent
tests for code that's already exercised.

## 7. Commit the new tests onto the PR

The task calls for the new coverage to land in the PR, not just locally:
- `git add` the new/modified test files only.
- Commit with a message describing what gap it closes (e.g. "Add test
  coverage for <endpoint/behavior> introduced in this PR").
- This pushes a commit to someone else's PR branch — a shared, visible
  action. Confirm with the user before pushing, then `git push origin
  HEAD:<headRefName>`.

## 8. Tear down and restore

- `cd tests && npm run down` to stop the disposable containers.
- `git checkout <original branch>` and pop the stash if one was made
  (`git stash pop`).

## 9. Give a merge recommendation

State explicitly **recommend merge** or **do not merge**, based on:
- Did the full suite pass (after any new tests were added)?
- Was the changed backend code actually exercised (originally, or after
  step 6's additions)?
- Any frontend changes, called out as untested by this suite rather than
  silently ignored.
- Anything else observed while running it (a migration that didn't apply
  cleanly, a flaky test, a missing local prerequisite like `ffmpeg`).

A "do not merge" verdict must name the specific failing test(s) or
uncovered behavior — not just a vague hesitation.

## 10. Wrap up

Summarize: which PR, whether tests passed, what coverage gaps (if any)
were found and closed, whether new commits were pushed, and the final
recommendation.
