import type { CompanyRepository } from "./company-repository";
import { DemoCompanyRepository } from "./demo-company-repository";
import { HttpCompanyRepository } from "./http-company-repository";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
export const companyRepository: CompanyRepository = isDemoMode ? new DemoCompanyRepository() : new HttpCompanyRepository(apiBase);
