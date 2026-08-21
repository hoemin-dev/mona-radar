import type { CompanyDetail, CompanySearchParams, CompanySearchResult, IndustryOption } from "../types";
import type { CompanyRepository } from "./company-repository";

export class HttpCompanyRepository implements CompanyRepository {
  constructor(private readonly baseUrl: string) {}
  private async request<T>(path: string): Promise<T> { const response=await fetch(`${this.baseUrl}${path}`); if(!response.ok) throw new Error(`API 요청 실패 (${response.status})`); return response.json() as Promise<T>; }
  search(params: CompanySearchParams): Promise<CompanySearchResult> { const query=new URLSearchParams({q:params.query,industry:params.industry,sort:params.sort,page:String(params.page),pageSize:String(params.pageSize)}); return this.request(`/companies?${query}`); }
  getDetail(companyId: string): Promise<CompanyDetail> { return this.request(`/companies/${encodeURIComponent(companyId)}`); }
  listIndustries(): Promise<IndustryOption[]> { return this.request("/industries"); }
}
