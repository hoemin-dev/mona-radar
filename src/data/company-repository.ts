import type { CompanyDetail, CompanySearchParams, CompanySearchResult, IndustryOption } from "../types";

export interface CompanyRepository {
  search(params: CompanySearchParams): Promise<CompanySearchResult>;
  getDetail(companyId: string): Promise<CompanyDetail>;
  listIndustries(): Promise<IndustryOption[]>;
}
