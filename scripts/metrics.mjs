import fs from "node:fs";
import path from "node:path";

// Weekly business follow-up for ace-receipts. Collects npm + GitHub metrics,
// appends a snapshot row, and prints a short read (the recurring analysis).
// Defensive: any failed fetch falls back to 0 so the job never breaks.

const REPO = process.env.GITHUB_REPOSITORY || "monkidy/ace-receipts";
const PKG = "ace-receipts";
const TOKEN = process.env.GITHUB_TOKEN || "";
const CSV = path.join("metrics", "ace-receipts.csv");
const HEADER = "date,npm_7d,npm_30d,stars,forks,open_issues,pro_issues";

function gh(url) {
  return fetch(url, {
    headers: {
      "User-Agent": "ace-receipts-metrics",
      Accept: "application/vnd.github+json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
}

async function safeJSON(promise, fallback) {
  try {
    const r = await promise;
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

async function npmDownloads(period) {
  const j = await safeJSON(
    fetch(`https://api.npmjs.org/downloads/point/${period}/${PKG}`),
    { downloads: 0 },
  );
  return Number(j.downloads || 0);
}

function previousRow() {
  if (!fs.existsSync(CSV)) return null;
  const lines = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const c = lines[lines.length - 1].split(",");
  return {
    npm_7d: Number(c[1] || 0),
    npm_30d: Number(c[2] || 0),
    stars: Number(c[3] || 0),
    forks: Number(c[4] || 0),
    open_issues: Number(c[5] || 0),
    pro_issues: Number(c[6] || 0),
  };
}

function delta(now, prev) {
  if (prev == null) return "";
  const d = now - prev;
  return d === 0 ? "=" : d > 0 ? `+${d}` : `${d}`;
}

async function main() {
  const npm7 = await npmDownloads("last-week");
  const npm30 = await npmDownloads("last-month");
  const repo = await safeJSON(gh(`https://api.github.com/repos/${REPO}`), {});
  const stars = Number(repo.stargazers_count || 0);
  const forks = Number(repo.forks_count || 0);
  const openIssues = Number(repo.open_issues_count || 0);
  const search = await safeJSON(
    gh(`https://api.github.com/search/issues?q=repo:${REPO}+is:issue+is:open+label:pro`),
    { total_count: 0 },
  );
  const proIssues = Number(search.total_count || 0);

  const date = new Date().toISOString().slice(0, 10);
  const prev = previousRow();

  fs.mkdirSync("metrics", { recursive: true });
  if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, HEADER + "\n", "utf8");
  fs.appendFileSync(
    CSV,
    `${date},${npm7},${npm30},${stars},${forks},${openIssues},${proIssues}\n`,
    "utf8",
  );

  // The recurring read: turn numbers into the next business move.
  let read;
  if (proIssues > 0) {
    read = "SIGNAL Phase 2: a 'pro' issue is open. Build and sell the Governance Pro Pack now.";
  } else if (prev && (npm7 > prev.npm_7d || stars > prev.stars)) {
    read = "Adoption rising. Keep distribution going: one more sharp post or a targeted message.";
  } else if (!prev) {
    read = "First snapshot recorded. Baseline set.";
  } else {
    read = "Flat week, no signal yet. Try a new angle or a new target audience for the next post.";
  }

  const summary = [
    `# ACE Receipts — weekly business follow-up (${date})`,
    "",
    "| Metric | Now | WoW |",
    "| --- | --- | --- |",
    `| npm downloads (7d) | ${npm7} | ${delta(npm7, prev?.npm_7d)} |`,
    `| npm downloads (30d) | ${npm30} | ${delta(npm30, prev?.npm_30d)} |`,
    `| GitHub stars | ${stars} | ${delta(stars, prev?.stars)} |`,
    `| Forks | ${forks} | ${delta(forks, prev?.forks)} |`,
    `| Open issues | ${openIssues} | ${delta(openIssues, prev?.open_issues)} |`,
    `| 'pro' issues (paid demand) | ${proIssues} | ${delta(proIssues, prev?.pro_issues)} |`,
    "",
    `**Read:** ${read}`,
    "",
  ].join("\n");

  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  }
}

main();
