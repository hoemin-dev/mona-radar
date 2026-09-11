const provinceDisplay: Record<string, string> = {
  "강원특별자치도": "강원도",
  "전북특별자치도": "전라북도",
  "제주특별자치도": "제주도",
  "세종특별자치시": "세종시",
};

const provinceAliases: Record<string, string> = {
  서울: "서울특별시", 서울시: "서울특별시", 서울특별시: "서울특별시",
  부산: "부산광역시", 부산시: "부산광역시", 부산광역시: "부산광역시",
  대구: "대구광역시", 대구시: "대구광역시", 대구광역시: "대구광역시",
  인천: "인천광역시", 인천시: "인천광역시", 인천광역시: "인천광역시",
  광주: "광주광역시", 광주시: "광주광역시", 광주광역시: "광주광역시",
  대전: "대전광역시", 대전시: "대전광역시", 대전광역시: "대전광역시",
  울산: "울산광역시", 울산시: "울산광역시", 울산광역시: "울산광역시",
  세종: "세종특별자치시", 세종시: "세종특별자치시", 세종특별자치시: "세종특별자치시",
  경기: "경기도", 경기도: "경기도", 강원: "강원특별자치도", 강원도: "강원특별자치도", 강원특별자치도: "강원특별자치도",
  전북: "전북특별자치도", 전북도: "전북특별자치도", 전라북도: "전북특별자치도", 전북특별자치도: "전북특별자치도",
  제주: "제주특별자치도", 제주도: "제주특별자치도", 제주특별자치도: "제주특별자치도",
};

const clean = (value: unknown) => String(value ?? "").trim().replace(/^—$/, "");
const GENERIC_OPERATORS = new Set(["민간(대행)", "공기업", "민간", "공공", "직영", "위탁", "민간위탁"]);
export function displayListOrganizations(value: unknown): string {
  return clean(value).split(",").map(name => name.trim()).filter(name => name && !GENERIC_OPERATORS.has(name.replace(/\s+/g, ""))).join(", ");
}

export function listFacilityStatus(status: unknown, raw?: unknown): "ACTIVE" | "INACTIVE" {
  const value = (clean(raw) || clean(status)).replace(/\s+/g, "");
  return /^(INACTIVE|SUSPENDED|CLOSED|STOPPED|폐쇄|폐지|중단|중지|운영중단|운영중지|가동중단|가동중지|사용중지|사용중단)(?:\s*\([^)]*\))?$/i.test(value) ? "INACTIVE" : "ACTIVE";
}

export function displayListStatus(status: unknown, raw?: unknown): string {
  return listFacilityStatus(status, raw) === "INACTIVE" ? "운영 중단·폐쇄" : "운영 중";
}
export const displayProvince = (value: unknown) => provinceDisplay[clean(value)] ?? clean(value);

const roadAddress = (address: string): string | undefined => {
  const parenthetical = [...address.matchAll(/\(([^()]*)\)/g)].map(match => match[1]!.trim());
  const outside = address.split(/\r?\n/).map(line => line.replace(/\([^()]*\)/g, " ").replace(/\s+/g, " ").trim());
  return [...outside, ...parenthetical].find(candidate => /[가-힣0-9·.-]+(?:대로|로|길)\s*\d/.test(candidate));
};

export const preferredAddress = (address: unknown): string => {
  const raw = clean(address);
  return roadAddress(raw) ?? raw.replace(/\s+/g, " ");
};

const explicitMetroCounty = (province: string, address: string): string => {
  const tokens = address.split(/\s+/).map(token => token.replace(/^[()]|[(),]$/g, "")).filter(Boolean);
  const provinceIndex = tokens.findIndex(token => provinceAliases[token] === province);
  const child = provinceIndex >= 0 ? tokens[provinceIndex + 1] : undefined;
  return child?.endsWith("군") || child?.endsWith("구") ? child : "";
};

export function displayRegion(province: unknown, city: unknown, address?: unknown): string {
  const officialProvince = clean(province);
  const evidencedCity = clean(city) || explicitMetroCounty(officialProvince, preferredAddress(address));
  return [displayProvince(officialProvince), evidencedCity].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(" ") || "—";
}

export function displayAddress(province: unknown, city: unknown, address: unknown): string {
  const officialProvince = clean(province);
  const shownProvince = displayProvince(officialProvince);
  const shownCity = clean(city);
  const tokens = preferredAddress(address).split(/\s+/).filter(Boolean);
  const addressProvince = provinceAliases[tokens[0] ?? ""];

  // An explicitly stated physical province in address_raw takes precedence over
  // normalized jurisdiction fields. Only remove prefix tokens we can prove duplicate.
  const prefixProvince = addressProvince ? displayProvince(addressProvince) : shownProvince;
  if (addressProvince) tokens.shift();
  const prefixCity = addressProvince && addressProvince !== officialProvince ? "" : shownCity;
  if (prefixCity && tokens[0] === prefixCity) tokens.shift();

  return [prefixProvince, prefixCity, ...tokens].filter(Boolean).filter((x, i, all) => i === 0 || x !== all[i - 1]).join(" ") || "—";
}
