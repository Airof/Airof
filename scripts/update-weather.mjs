// scripts/update-weather.mjs
// Node 18+ has global fetch. No dependencies needed.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const README_PATH = resolve(__dirname, "..", "README.md");

// Shiraz, Iran (static)
const LAT = 29.5918;
const LON = 52.5837;

// Map Open-Meteo weather codes -> emoji/text
const codeMap = {
  0: "☀️ Clear",
  1: "🌤 Mostly clear",
  2: "⛅ Partly cloudy",
  3: "☁️ Overcast",
  45: "🌫 Fog",
  48: "🌫 Depositing rime fog",
  51: "🌦 Light drizzle",
  53: "🌦 Drizzle",
  55: "🌧️ Heavy drizzle",
  56: "🌦 Freezing drizzle",
  57: "🌧️ Heavy freezing drizzle",
  61: "🌦 Light rain",
  63: "🌧️ Rain",
  65: "🌧️ Heavy rain",
  66: "🌧️ Freezing rain",
  67: "🌧️ Heavy freezing rain",
  71: "🌨️ Light snow",
  73: "🌨️ Snow",
  75: "❄️ Heavy snow",
  77: "❄️ Snow grains",
  80: "🌦 Rain showers",
  81: "🌧️ Rain showers",
  82: "🌧️ Heavy showers",
  85: "🌨️ Snow showers",
  86: "❄️ Heavy snow showers",
  95: "⛈ Thunderstorm",
  96: "⛈ Thunderstorm w/ hail",
  99: "⛈ Severe thunderstorm w/ hail"
};

function greetingByHour(hour) {
  if (hour >= 5 && hour < 12) return "☀️ Good Morning";
  if (hour >= 12 && hour < 18) return "🌤 Good Afternoon";
  if (hour >= 18 && hour < 23) return "🌆 Good Evening";
  return "🌙 Night Owl Mode";
}

function toKmH(ms) {
  return Math.round(ms * 3.6);
}

async function fetchWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=Asia%2FTehran`;
  const r = await fetch(url, { headers: { "User-Agent": "github-readme-weather" } });
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  return r.json();
}

function renderLine(data) {
  const cur = data.current;
  const tz = data.timezone || "Asia/Tehran";
  const dt = new Date(cur.time);
  const hour = dt.getHours();
  const greet = greetingByHour(hour);

  const temp = Math.round(cur.temperature_2m);         // °C
  const wcode = cur.weather_code;
  const wtext = codeMap[wcode] || "Weather";
  const windKmh = toKmH(cur.wind_speed_10m || 0);
  const windDir = Math.round(cur.wind_direction_10m || 0);

  // Example line:
  // ☀️ Good Morning from Shiraz — 34°C, 🌤 Mostly clear | 💨 12 km/h (NE) | Updated: 2025‑08‑24 18:05 Asia/Tehran
  const compass = (deg) => {
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
    return dirs[Math.round(deg / 22.5)];
  };

  const timestamp = dt.toISOString().replace("T", " ").slice(0, 16);

  return `${greet} from **Shiraz** — **${temp}°C**, ${wtext} · 💨 ${windKmh} km/h (${compass(windDir)}) · _Updated: ${timestamp} ${tz}_`;
}

function updateReadme(line) {
  const start = "<!-- WEATHER:START -->";
  const end = "<!-- WEATHER:END -->";
  const md = readFileSync(README_PATH, "utf8");

  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  const replacement = `${start}\n${line}\n${end}`;

  if (!pattern.test(md)) {
    throw new Error("Markers <!-- WEATHER:START --> and <!-- WEATHER:END --> not found in README.md");
  }

  const updated = md.replace(pattern, replacement);
  if (updated !== md) {
    writeFileSync(README_PATH, updated);
    return true;
  }
  return false;
}

(async () => {
  try {
    const data = await fetchWeather();
    const line = renderLine(data);
    const changed = updateReadme(line);
    console.log(changed ? "README weather updated." : "No change.");
  } catch (e) {
    console.error("Update failed:", e.message);
    process.exit(1);
  }
})();
