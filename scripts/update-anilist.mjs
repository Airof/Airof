// scripts/update-anilist.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const USERNAME = process.env.ANILIST_USERNAME || 'Airof';
const README_PATH = resolve(process.cwd(), 'README.md');
const START = '<!-- ANILIST:START -->';
const END   = '<!-- ANILIST:END -->';

// GraphQL query: user-level aggregate stats (anime + manga)
const query = `
query ($name: String) {
  User(name: $name) {
    name
    siteUrl
    statistics {
      anime {
        count
        episodesWatched
        minutesWatched
        meanScore
      }
      manga {
        count
        chaptersRead
        volumesRead
        meanScore
      }
    }
  }
}
`;

async function fetchAniList(username) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { name: username } }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AniList API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function fmt(n) {
  return new Intl.NumberFormat('en-US').format(n ?? 0);
}

function renderBlock(data) {
  const u = data?.User;
  if (!u) return '\n_Unable to load AniList data at this time._\n';

  const a = u.statistics?.anime ?? {};
  const m = u.statistics?.manga ?? {};
  const daysWatched = (a.minutesWatched ?? 0) / 60 / 24;

  return [
    '',
    `**Profile:** [${u.name}](${u.siteUrl})`,
    '',
    '| Metric | Anime | Manga |',
    '|---|---:|---:|',
    `| Count | ${fmt(a.count)} | ${fmt(m.count)} |`,
    `| Episodes watched | ${fmt(a.episodesWatched)} | — |`,
    `| Minutes watched | ${fmt(a.minutesWatched)} | — |`,
    `| ~Days watched | ${daysWatched.toFixed(1)} | — |`,
    `| Mean score | ${fmt(a.meanScore)} | ${fmt(m.meanScore)} |`,
    `| Chapters read | — | ${fmt(m.chaptersRead)} |`,
    `| Volumes read | — | ${fmt(m.volumesRead)} |`,
    ''
  ].join('\n');
}

async function updateReadme(block) {
  let readme = await readFile(README_PATH, 'utf8');

  // If markers are missing, append a section at the end for safety.
  if (!readme.includes(START) || !readme.includes(END)) {
    readme += `\n\n## 📊 Anime Stats\n${START}\n${block}\n${END}\n`;
    await writeFile(README_PATH, readme, 'utf8');
    console.log('Inserted AniList section and updated README.');
    return;
  }

  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  const next = readme.replace(pattern, `${START}\n${block}\n${END}`);
  if (next !== readme) {
    await writeFile(README_PATH, next, 'utf8');
    console.log('README updated with AniList stats.');
  } else {
    console.log('No changes to README (AniList stats unchanged).');
  }
}

(async () => {
  const data = await fetchAniList(USERNAME);
  const block = renderBlock(data);
  await updateReadme(block);
})().catch(err => {
  console.error('AniList update failed:', err.message);
  process.exit(1);
});
