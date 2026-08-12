const STORE_HOSTS = new Set(["store.steampowered.com", "www.store.steampowered.com"]);
const PLAYER_CATEGORY_IDS = new Set([1, 2, 9, 24, 38, 39, 49]);
const REVIEW_LABELS = {
  1: "압도적으로 부정적",
  2: "매우 부정적",
  3: "부정적",
  4: "대체로 부정적",
  5: "복합적",
  6: "대체로 긍정적",
  7: "긍정적",
  8: "매우 긍정적",
  9: "압도적으로 긍정적",
};

export function parseSteamAppId(value) {
  const input = String(value || "").trim();
  if (/^\d+$/.test(input)) return input;
  let url;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== "https:" || !STORE_HOSTS.has(url.hostname.toLowerCase())) return null;
  return url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1] || null;
}

const unique = values => [...new Set(values.filter(Boolean))];

export function normalizeSteamGame(appId, details, reviewSummary = {}) {
  const screenshots = Array.isArray(details.screenshots) ? details.screenshots.map(item => item?.path_full) : [];
  const media = unique([details.header_image, ...screenshots]);
  const genres = Array.isArray(details.genres) ? details.genres.map(item => item?.description) : [];
  const players = Array.isArray(details.categories)
    ? details.categories.filter(item => PLAYER_CATEGORY_IDS.has(Number(item?.id))).map(item => item?.description)
    : [];
  const price = details.is_free ? "무료" : details.price_overview?.final_formatted || "가격 미정";
  const initialPrice = details.is_free ? "무료" : details.price_overview?.initial_formatted || price;
  const discountPercent = Number(details.price_overview?.discount_percent) || 0;
  const score = Number(reviewSummary.review_score);

  return {
    steamAppId: String(appId),
    steamUrl: `https://store.steampowered.com/app/${appId}/`,
    title: details.name || "Steam 게임",
    tagline: details.short_description || "한줄 설명을 입력하세요.",
    price: price.replace(/^₩\s+/, "₩"),
    originalPrice: initialPrice.replace(/^₩\s+/, "₩"),
    discountPercent,
    date: details.release_date?.date || "출시일 미정",
    genre: genres.join(" / ") || "장르 미정",
    players: players.join(" / ") || "플레이 정보 미정",
    rating: REVIEW_LABELS[score] || reviewSummary.review_score_desc || "평가 없음",
    summary: details.short_description || "게임 소개를 입력하세요.",
    media,
  };
}

export function extractCompletionPlaytime(reviews = []) {
  const completionWords = /(엔딩|클리어|완주|끝까지|다[\s]*깼|completed|completion|finished|finish(ed)? the game|beat the game|ending)/i;
  const values = reviews.map(review => String(review?.review || "")).filter(text => completionWords.test(text)).map(text => {
    const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:시간|hours?|hrs?)/i);
    if (hours) return Number(hours[1]);
    const minutes = text.match(/(\d+)\s*(?:분|minutes?|mins?)/i);
    return minutes ? Math.round(Number(minutes[1]) / 6) / 10 : 0;
  }).filter(value => value > 0).sort((a, b) => a - b);
  if (!values.length) return "";
  const middle = Math.floor(values.length / 2), median = values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) * 5) / 10;
  return `${median}시간`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "ddonggemnyeo-live/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Steam 응답 오류 (${response.status})`);
  return response.json();
}

export async function fetchSteamGame(appId) {
  const detailsUrl = new URL("https://store.steampowered.com/api/appdetails");
  detailsUrl.search = new URLSearchParams({ appids: appId, l: "korean", cc: "kr" });
  const reviewsUrl = new URL(`https://store.steampowered.com/appreviews/${appId}`);
  reviewsUrl.search = new URLSearchParams({ json: "1", language: "all", purchase_type: "all", num_per_page: "100" });

  const [detailsResponse, reviewsResponse] = await Promise.all([
    fetchJson(detailsUrl),
    fetchJson(reviewsUrl).catch(() => ({ query_summary: {} })),
  ]);
  const entry = detailsResponse?.[appId];
  if (!entry?.success || entry.data?.type !== "game") throw new Error("Steam에서 게임 정보를 찾지 못했습니다.");
  const game = normalizeSteamGame(appId, entry.data, reviewsResponse?.query_summary);
  return { ...game, completionPlaytime: extractCompletionPlaytime(reviewsResponse?.reviews || []) };
}
