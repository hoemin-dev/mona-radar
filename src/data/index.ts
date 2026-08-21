import type { CompanyRepository } from "./company-repository";
import { DemoCompanyRepository } from "./demo-company-repository";
import { HttpCompanyRepository } from "./http-company-repository";

const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
export const companyRepository: CompanyRepository = apiBase ? new HttpCompanyRepository(apiBase) : new DemoCompanyRepository();
export const isDemoMode = !apiBase;
