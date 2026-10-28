import { Brevet } from "../types";
import { dateStringToNum } from "../date";
import { countByKey, makeCollisionSafeObjectID } from "./id-utils";
import { checkOk } from "./fetch-utils";

const country = "Ireland";

const SITE = "https://www.audaxireland.org";
const CALENDAR_PAGE = `${SITE}/events-calendar/`;
const PAGES_API = `${SITE}/wp-json/wp/v2/pages`;

type Location = {
  name: string;
  lat: number;
  lng: number;
  date: string; // dd/mm/yyyy
  distance: string;
  county: string;
  url: string; // relative
};

type Row = {
  date: string; // dd/mm/yyyy
  name: string;
  url: string;
  distances: number[];
  county: string;
  ascent: number;
};

type Detail = {
  start?: string;
  organiser?: string;
  club?: string;
  mail?: string;
};

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The calendar page embeds the map markers as `var locations=[{...}];`
 */
function parseLocations(html: string): Location[] {
  // it's part of a larger `var a=[...],b=...` declaration, so don't rely on a `;`
  const match = /var locations=(\[[\s\S]*?\}\])(?=[,;])/.exec(html);
  if (!match) {
    throw new Error(`Unable to find the map locations on ${CALENDAR_PAGE}`);
  }
  return JSON.parse(match[1]);
}

/**
 * The calendar page renders every ride (one row per date) in `.aij-calendar-table`
 */
function parseRows(html: string): Row[] {
  const rows: Row[] = [];
  for (const [, tr] of html.matchAll(
    /<tr>(\s*<td>\d{2}\/\d{2}\/\d{4}<\/td>[\s\S]*?)<\/tr>/g,
  )) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (m) => m[1],
    );
    if (cells.length < 4) continue;
    const link = /<a href="([^"]+)">([\s\S]*?)<\/a>/.exec(cells[1]);
    if (!link) continue;
    const ascent = /([\d,]+) m elevation gain/.exec(cells[1]);
    rows.push({
      date: stripTags(cells[0]),
      name: stripTags(link[2]).replace(/\s*\([^)]*km details[^)]*\)\s*$/, ""),
      url: link[1],
      distances: (stripTags(cells[2]).match(/\d+/g) || []).map(Number),
      county: stripTags(cells[3]),
      ascent: ascent ? parseInt(ascent[1].replace(/,/g, ""), 10) : 0,
    });
  }
  return rows;
}

/**
 * Each event has a page whose content is a list of `Label: value` paragraphs, with
 * slightly different labels per event. They are all available through the WordPress
 * REST API in a few requests.
 */
function parseDetail(html: string): Detail {
  // some pages put several `Label: value` lines in one paragraph, separated by <br>
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].flatMap(
    (m) => m[1].split(/<br\s*\/?>/i).map(stripTags),
  );
  const field = (label: RegExp) => {
    for (const text of paragraphs) {
      const value = new RegExp(`^(?:${label.source})\\s*:\\s*(.+)$`, "i")
        .exec(text)?.[1]
        ?.trim();
      // "Start: 8.00am" is a time, not a place
      if (value && !/^\d{1,2}[.:]\d{2}\s*(am|pm)?$/i.test(value)) return value;
    }
  };
  return {
    start: field(
      /Start Location|Start Point|Start\/Finish|Start Venue|Start|Location/,
    ),
    organiser: field(/Organiser/),
    club: field(/Organising Club/),
    mail: /href="mailto:([^"?]+)/i.exec(html)?.[1],
  };
}

async function fetchDetails(): Promise<Map<string, Detail>> {
  const details = new Map<string, Detail>();
  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    const response = await fetch(
      `${PAGES_API}?per_page=100&page=${page}&_fields=link,content`,
    ).then(checkOk);
    totalPages = Number(response.headers.get("x-wp-totalpages")) || 1;
    const pages: Array<{ link: string; content: { rendered: string } }> =
      await response.json();
    for (const { link, content } of pages) {
      if (link.includes("/events-calendar/gazetteer/")) {
        details.set(link, parseDetail(content.rendered));
      }
    }
  }
  return details;
}

function absolute(url: string) {
  return new URL(url, SITE).href;
}

function toBrevets(
  rows: Row[],
  locations: Location[],
  details: Map<string, Detail>,
): Brevet[] {
  // the map only has one marker per event page and date, other editions of the
  // same event take place at the same start, so fall back to any marker of the page
  const locationByUrl = new Map(locations.map((l) => [absolute(l.url), l]));

  // some rows only say "See event details", reuse the distance of another edition
  const distancesByUrl = new Map(
    rows.filter((r) => r.distances.length).map((r) => [r.url, r.distances]),
  );

  const prepared = rows.flatMap((row) => {
    const [day, month, year] = row.date.split("/");
    const dateNumber = dateStringToNum(`${year}-${month}-${day}`);
    const site = absolute(row.url);
    const detail = details.get(site);
    const location = locationByUrl.get(site);
    return (
      row.distances.length ? row.distances : distancesByUrl.get(row.url) || [0]
    ).map((distance) => ({
      row,
      distance,
      dateNumber,
      site,
      detail,
      location,
      baseObjectID: [
        row.date,
        distance,
        country,
        detail?.start || row.county || row.name,
      ].join("__"),
    }));
  });

  const counts = countByKey(prepared.map((x) => x.baseObjectID));

  return prepared.map(
    ({ row, distance, dateNumber, site, detail, location, baseObjectID }) => ({
      objectID: makeCollisionSafeObjectID(baseObjectID, counts, row.name),
      date: row.date,
      dateNumber,
      distance,
      name: row.name,
      country,
      region: row.county,
      city: detail?.start || row.county,
      _geoloc: location
        ? [{ lat: location.lat, lng: location.lng }]
        : undefined,
      site,
      mail: detail?.mail,
      club: detail?.club || detail?.organiser || "",
      ascent: row.ascent || undefined,
      meta: { ...row, ...detail },
    }),
  );
}

export async function getData() {
  console.log("Fetching Ireland brevets...");
  const html = await fetch(CALENDAR_PAGE)
    .then(checkOk)
    .then((res) => res.text());
  const rows = parseRows(html);
  if (rows.length === 0) {
    throw new Error(`Unable to parse any rides from ${CALENDAR_PAGE}`);
  }
  const locations = parseLocations(html);
  const details = await fetchDetails();
  return toBrevets(rows, locations, details);
}
