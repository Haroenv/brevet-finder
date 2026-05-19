import * as cheerio from 'cheerio';
import { Brevet } from '../types';
import { checkOk } from './fetch-utils';

type ClubEntry = { name: string; site: string; tokens: Set<string> };
type Registry = Map<string, ClubEntry[]>;

const NORDIC_MAP: Record<string, string> = {
  'ø': 'o', 'Ø': 'o',
  'æ': 'ae', 'Æ': 'ae',
  'å': 'a', 'Å': 'a',
};

const STOPWORDS = new Set([
  'ara', 'ard', 'aci', 'us', 'cd', 'ac', 'asd', 'ssd', 'srl', 'cde',
  'sc', 'gs', 'gc', 'sd', 'soc', 'societa', 'associazione',
  'club', 'clube', 'cycling', 'cyclisme', 'ciclistico', 'ciclistica', 'ciclista',
  'deportivo', 'deportiva', 'sportivo', 'sportiva', 'sport',
  'pena', 'penya', 'penha', 'grupo', 'gruppo', 'team', 'union', 'unione',
  'audax', 'randonneur', 'randonneurs', 'randonnee', 'randonnées',
  'velo', 'cycl', 'bicicletta', 'bike', 'asd', 'aps',
  'de', 'di', 'da', 'des', 'la', 'le', 'lo', 'el', 'los', 'las', 'il', 'i', 'gli',
  'and', 'y', 'e', 'a',
]);

function tokenize(value: string): Set<string> {
  let lower = value.toLowerCase();
  for (const [from, to] of Object.entries(NORDIC_MAP)) {
    lower = lower.split(from.toLowerCase()).join(to);
  }
  const stripped = lower
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const tokens = stripped.split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(tokens.filter((t) => !STOPWORDS.has(t)));
}

function titleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchSpain(): Promise<Array<{ name: string; site: string }>> {
  const html = await fetch('https://rancat.cat/clubs/', {
    headers: { 'User-Agent': 'Mozilla/5.0 brm-search' },
  })
    .then(checkOk)
    .then((r) => r.text());
  const $ = cheerio.load(html);
  const out = new Map<string, { name: string; site: string }>();
  $('a[href*="/clubs/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/^https?:\/\/rancat\.cat\/clubs\/([a-z0-9-]+)\/$/i);
    if (!m) return;
    const slug = m[1];
    if (slug === 'feed') return;
    const name = $(el).text().trim() || titleCaseFromSlug(slug);
    out.set(slug, { name, site: `https://rancat.cat/clubs/${slug}/` });
  });
  return [...out.values()];
}

async function fetchGermany(): Promise<Array<{ name: string; site: string }>> {
  const html = await fetch('https://www.audax-randonneure.de/startorte', {
    headers: { 'User-Agent': 'Mozilla/5.0 brm-search' },
  })
    .then(checkOk)
    .then((r) => r.text());
  const $ = cheerio.load(html);
  const out = new Map<string, { name: string; site: string }>();
  $('a[href^="/startorte/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/^\/startorte\/([a-z0-9_-]+)$/i);
    if (!m) return;
    const slug = m[1];
    const text = $(el).text().trim();
    if (!text || /^anmeldung/i.test(text)) return;
    out.set(slug, {
      name: text,
      site: `https://www.audax-randonneure.de/startorte/${slug}`,
    });
  });
  return [...out.values()];
}

async function fetchDenmark(): Promise<Array<{ name: string; site: string }>> {
  const html = await fetch('https://www.audax-club.dk/', {
    headers: { 'User-Agent': 'Mozilla/5.0 brm-search' },
  })
    .then(checkOk)
    .then((r) => r.text());
  const $ = cheerio.load(html);
  const out = new Map<string, { name: string; site: string }>();
  const regions = new Set([
    'hovedstaden', 'sjaelland', 'soenderjylland',
    'midtjylland', 'nordjylland', 'sydjylland', 'fyn', 'bornholm',
  ]);
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/^\/([a-z]+)(?:\/|$)/i);
    if (!m) return;
    const slug = m[1].toLowerCase();
    if (!regions.has(slug)) return;
    const text = $(el).text().trim();
    if (!text) return;
    if (!out.has(slug)) {
      out.set(slug, {
        name: text,
        site: `https://www.audax-club.dk/${slug}`,
      });
    }
  });
  return [...out.values()];
}

async function fetchItaly(): Promise<Array<{ name: string; site: string }>> {
  const baseUrl = 'https://www.audaxitalia.it/index.php?pg=organizzatori';
  const seen = new Map<string, { name: string; site: string }>();

  let offset = 0;
  const pageSize = 21;
  while (offset < 500) {
    const url = offset === 0 ? baseUrl : `${baseUrl}&lim_organizzatore=${offset}`;
    const html = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 brm-search' },
    })
      .then(checkOk)
      .then((r) => r.text());
    const $ = cheerio.load(html);
    let added = 0;
    $('a[href*="pg=organizzatori"][href*="org="]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/org=(\d+)/);
      if (!m) return;
      const id = m[1];
      const text = $(el).text().trim();
      if (!text) return;
      if (seen.has(id)) return;
      added++;
      seen.set(id, {
        name: text,
        site: `https://www.audaxitalia.it/index.php?pg=organizzatori&org=${id}`,
      });
    });
    if (added === 0) break;
    offset += pageSize;
  }

  return [...seen.values()];
}

const COUNTRY_FETCHERS: Record<string, () => Promise<Array<{ name: string; site: string }>>> = {
  Spain: fetchSpain,
  Germany: fetchGermany,
  Denmark: fetchDenmark,
  Italy: fetchItaly,
};

export async function buildClubRegistry(): Promise<Registry> {
  console.log('Fetching federation club directories...');
  const registry: Registry = new Map();
  const results = await Promise.all(
    Object.entries(COUNTRY_FETCHERS).map(async ([country, fetcher]) => {
      try {
        const entries = await fetcher();
        return { country, entries };
      } catch (error) {
        console.error(`  ${country}: failed`, error);
        return { country, entries: [] as Array<{ name: string; site: string }> };
      }
    })
  );

  for (const { country, entries } of results) {
    const enriched: ClubEntry[] = entries.map((e) => ({
      ...e,
      tokens: tokenize(e.name),
    }));
    registry.set(country, enriched);
    console.log(`  ${country}: ${entries.length} clubs`);
  }
  return registry;
}

function scoreMatch(brevetTokens: Set<string>, entry: ClubEntry): number {
  let shared = 0;
  let longShared = 0;
  let sharedCharLen = 0;
  for (const t of brevetTokens) {
    if (entry.tokens.has(t)) {
      shared++;
      sharedCharLen += t.length;
      if (t.length >= 5) longShared++;
    }
  }
  if (shared === 0) return 0;

  const minSize = Math.min(brevetTokens.size, entry.tokens.size);
  const coverage = shared / Math.max(1, minSize);

  // Strong match: at least one long distinctive token (>=5 chars)
  if (longShared >= 1) return 1000 + shared * 10 + sharedCharLen;

  // Weaker match: multiple short tokens covering >=50% of the smaller side,
  // with at least one token of length >=4 (avoid 1-2 letter coincidences).
  const hasFourCharToken = [...brevetTokens].some(
    (t) => t.length >= 4 && entry.tokens.has(t)
  );
  if (shared >= 2 && coverage >= 0.5 && hasFourCharToken) {
    return 500 + shared * 10 + sharedCharLen;
  }

  return 0;
}

export function lookupSite(
  registry: Registry,
  country: string,
  club: string
): string | undefined {
  if (!club) return undefined;
  const entries = registry.get(country);
  if (!entries) return undefined;
  const brevetTokens = tokenize(club);
  if (brevetTokens.size === 0) return undefined;

  let best: ClubEntry | undefined;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreMatch(brevetTokens, entry);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best?.site;
}

export function enrichBrevets(brevets: Brevet[], registry: Registry): Brevet[] {
  let enriched = 0;
  const result = brevets.map((b) => {
    if (b.site && b.site.trim()) return b;
    const site = lookupSite(registry, b.country, b.club);
    if (!site) return b;
    enriched++;
    return { ...b, site };
  });
  console.log(`Enriched ${enriched} brevets with club sites from federation directories`);
  return result;
}
