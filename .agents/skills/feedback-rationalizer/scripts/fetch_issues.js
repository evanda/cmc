const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Adapted from evanda/bub. Repos are overridable via env so a deployment
// (a friend's church instance) can point at its own feedback repo without
// editing this script — nothing church-specific is hardcoded.
//   CMC_FEEDBACK_REPO  public feedback intake repo (default evanda/cmc-feedback)
//   CMC_INTERNAL_REPO  internal work-tracking repo  (default evanda/cmc)

function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    console.error(`Error running command: ${cmd}`);
    console.error('Make sure you have the gh CLI installed and authenticated (run `gh auth status`).');
    process.exit(1);
  }
}

function fetchIssues() {
  const publicRepo = process.env.CMC_FEEDBACK_REPO || 'evanda/cmc-feedback';
  const internalRepo = process.env.CMC_INTERNAL_REPO || 'evanda/cmc';

  console.log(`Fetching open public feedback issues from ${publicRepo}...`);
  const publicIssuesRaw = runCommand(
    `gh issue list --repo ${publicRepo} --state open --limit 100 --json number,title,body,state,createdAt,labels`
  );
  const publicIssues = JSON.parse(publicIssuesRaw);

  console.log(`Fetching open internal issues from ${internalRepo}...`);
  const internalIssuesRaw = runCommand(
    `gh issue list --repo ${internalRepo} --state open --limit 100 --json number,title,body,state,createdAt,labels`
  );
  const internalIssues = JSON.parse(internalIssuesRaw);

  const data = {
    fetchedAt: new Date().toISOString(),
    publicRepo,
    internalRepo,
    publicIssues,
    internalIssues,
  };

  const outputFilename = process.argv[2] || 'feedback_issues.json';
  const outputPath = path.resolve(process.cwd(), outputFilename);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nSuccess! Output written to: ${outputPath}`);
}

fetchIssues();
