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
    `[![AniList Profile](https://img.shields.io/badge/AniList-${encodeURIComponent(u.name)}-02A9FF?style=for-the-badge&logo=anilist&logoColor=white)](${u.siteUrl})`,
    '',
    '### 🎬 Anime Statistics',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Count | ${fmt(a.count)} |`,
    `| Episodes watched | ${fmt(a.episodesWatched)} |`,
    `| Minutes watched | ${fmt(a.minutesWatched)} |`,
    `| ~Days watched | ${Number.isFinite(daysWatched) ? daysWatched.toFixed(1) : '0.0'} |`,
    `| Mean score | ${fmt(a.meanScore)} |`,
    '',
    '### 📚 Manga Statistics',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Count | ${fmt(m.count)} |`,
    `| Chapters read | ${fmt(m.chaptersRead)} |`,
    `| Volumes read | ${fmt(m.volumesRead)} |`,
    `| Mean score | ${fmt(m.meanScore)} |`,
    ''
  ].join('\n');
}

async function updateReadme(block) {
  let readme;
  try {
    readme = await readFile(README_PATH, 'utf8');
  } catch {
    // If README doesn't exist, create one with the section.
    const fresh = `# Profile\n\n## 📊 Anime Stats\n${START}\n${block}\n${END}\n`;
    await writeFile(README_PATH, fresh, 'utf8');
    console.log('README created with AniList section.');
    return;
  }

  if (!readme.includes(START) || !readme.includes(END)) {
    // Append section if markers are missing
    const next = `${readme.trim()}\n\n## 📊 Anime Stats\n${START}\n${block}\n${END}\n`;
    await writeFile(README_PATH, next, 'utf8');
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
