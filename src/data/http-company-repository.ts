import type { CompanyDetail, CompanySearchParams, CompanySearchResult, IndustryOption } from "../types";
import type { CompanyRepository } from "./company-repository";

export class HttpCompanyRepository implements CompanyRepository {
  constructor(private readonly baseUrl: string) {}
  private async request<T>(path: string, signal?: AbortSignal): Promise<T> { const response=await fetch(`${this.baseUrl}${path}`,{signal}); if(!response.ok) { const error=await response.json().catch(()=>({})); throw new Error(error.error || `API 요청 실패 (${response.status})`); } return response.json() as Promise<T>; }
  search(params: CompanySearchParams): Promise<CompanySearchResult> { const query=new URLSearchParams({q:params.query,industry:params.industry,sort:params.sort,page:String(params.page),target:params.target??"",favorite:params.favorite??"",classified:params.classified??""}); return this.request(`/companies?${query}`,params.signal); }
  getDetail(companyId: string): Promise<CompanyDetail> { return this.request(`/companies/${encodeURIComponent(companyId)}`); }
  listIndustries(): Promise<IndustryOption[]> { return this.request("/industries"); }
}
