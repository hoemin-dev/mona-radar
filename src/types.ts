export type Domain = "company" | "facility";
export type View = "search" | "dash" | "analysis";
export type SortOption = "name-asc" | "revenue-desc" | "recent-desc";

export interface Company {
  companyId: string;
  sminfoKcd: string;
  businessNumber?: string;
  companyName: string;
  representativeName?: string;
  companyType?: string;
  companyStatus?: string;
  establishedDate?: string;
  address?: string;
  roadAddress?: string;
  homepageUrl?: string;
  mainProducts?: string;
  ksicCode?: string;
  industryName?: string;
  fiscalYear?: number;
  totalAssetsKrwMillion?: number;
  revenueKrwMillion?: number;
  operatingIncomeKrwMillion?: number;
  netIncomeKrwMillion?: number;
  lastCollectedAt?: string;
}

export interface DetailRow { [key: string]: string | number | null | undefined; }
export interface CompanyDetail {
  company: Company;
  financialStatements: DetailRow[];
  businessSites: DetailRow[];
  histories: DetailRow[];
  executives: DetailRow[];
  certifications: DetailRow[];
  designations: DetailRow[];
  factories: DetailRow[];
  patents: DetailRow[];
}
export interface IndustryOption { id: string; name: string; }
export interface CompanySearchParams { query: string; industry: string; sort: SortOption; page: number; pageSize: number; }
export interface CompanySearchResult { rows: Company[]; total: number; page: number; totalPages: number; }
