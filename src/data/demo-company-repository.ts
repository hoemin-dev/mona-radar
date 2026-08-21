import type { Company, CompanyDetail, CompanySearchParams, CompanySearchResult, DetailRow, IndustryOption } from "../types";
import type { CompanyRepository } from "./company-repository";

const companies: Company[] = [
  { companyId:"mona-001",sminfoKcd:"SM-10001",businessNumber:"101-81-10001",companyName:"그린플로우",representativeName:"김민아",companyType:"중소기업",companyStatus:"정상",establishedDate:"2012-04-18",roadAddress:"경기도 성남시 분당구 판교로",homepageUrl:"https://example.com",mainProducts:"산업용 펌프, 유체 제어 시스템",ksicCode:"C29131",industryName:"액체 펌프 제조업",fiscalYear:2025,totalAssetsKrwMillion:18420,revenueKrwMillion:12780,operatingIncomeKrwMillion:1260,netIncomeKrwMillion:940,lastCollectedAt:"2026-08-10" },
  { companyId:"mona-002",sminfoKcd:"SM-10002",businessNumber:"120-86-22002",companyName:"대성환경기술",representativeName:"박준호",companyType:"중기업",companyStatus:"정상",establishedDate:"2005-09-02",roadAddress:"인천광역시 남동구 남동대로",mainProducts:"수처리 설비, 여과 장치",ksicCode:"C29175",industryName:"액체 여과기 제조업",fiscalYear:2025,totalAssetsKrwMillion:32100,revenueKrwMillion:28450,operatingIncomeKrwMillion:2180,netIncomeKrwMillion:1640,lastCollectedAt:"2026-08-09" },
  { companyId:"mona-003",sminfoKcd:"SM-10003",businessNumber:"312-87-33003",companyName:"모나테크",representativeName:"이서윤",companyType:"벤처기업",companyStatus:"정상",establishedDate:"2018-01-15",roadAddress:"충청남도 천안시 서북구 직산읍",mainProducts:"스마트 센서, 원격 모니터링",ksicCode:"C26295",industryName:"전자 감지장치 제조업",fiscalYear:2025,totalAssetsKrwMillion:9650,revenueKrwMillion:8420,operatingIncomeKrwMillion:1170,netIncomeKrwMillion:860,lastCollectedAt:"2026-08-08" },
  { companyId:"mona-004",sminfoKcd:"SM-10004",businessNumber:"410-81-44004",companyName:"세진기공",representativeName:"최현우",companyType:"중소기업",companyStatus:"정상",establishedDate:"1999-11-23",roadAddress:"광주광역시 광산구 하남산단",mainProducts:"산업용 밸브, 배관 부품",ksicCode:"C29133",industryName:"탭, 밸브 및 유사장치 제조업",fiscalYear:2024,totalAssetsKrwMillion:22300,revenueKrwMillion:19620,operatingIncomeKrwMillion:1320,netIncomeKrwMillion:980,lastCollectedAt:"2026-08-07" },
  { companyId:"mona-005",sminfoKcd:"SM-10005",businessNumber:"502-86-55005",companyName:"에코웨이브",representativeName:"정다은",companyType:"소기업",companyStatus:"정상",establishedDate:"2020-06-30",roadAddress:"대구광역시 달성군 국가산단",mainProducts:"수질 분석기, 환경 데이터 플랫폼",ksicCode:"C27213",industryName:"물질 검사·측정 및 분석기구 제조업",fiscalYear:2025,totalAssetsKrwMillion:5810,revenueKrwMillion:4720,operatingIncomeKrwMillion:610,netIncomeKrwMillion:430,lastCollectedAt:"2026-08-06" },
  { companyId:"mona-006",sminfoKcd:"SM-10006",businessNumber:"606-81-66006",companyName:"한빛엔지니어링",representativeName:"윤태식",companyType:"중기업",companyStatus:"정상",establishedDate:"2008-03-11",roadAddress:"부산광역시 강서구 녹산산단",mainProducts:"환경 플랜트 설계, 유지보수",ksicCode:"M72129",industryName:"기타 엔지니어링 서비스업",fiscalYear:2025,totalAssetsKrwMillion:41700,revenueKrwMillion:36750,operatingIncomeKrwMillion:2840,netIncomeKrwMillion:2070,lastCollectedAt:"2026-08-05" }
];

const empty = (): DetailRow[] => [];
const details = new Map(companies.map((company): [string, CompanyDetail] => [company.companyId, {
  company,
  financialStatements: [{ fiscalYear:company.fiscalYear, revenue:company.revenueKrwMillion, operatingIncome:company.operatingIncomeKrwMillion, netIncome:company.netIncomeKrwMillion, totalAssets:company.totalAssetsKrwMillion }],
  businessSites: [{ siteName:"본사", siteType:"본점", businessNumber:company.businessNumber, address:company.roadAddress }],
  histories: [{ eventDate:company.establishedDate, description:"회사 설립" }], executives:empty(), certifications:empty(), designations:empty(), factories:empty(), patents:empty()
}]));

const normalize = (value?: string | number) => String(value ?? "").toLocaleLowerCase();
export class DemoCompanyRepository implements CompanyRepository {
  async search(params: CompanySearchParams): Promise<CompanySearchResult> {
    const query = normalize(params.query).trim();
    let rows = companies.filter((company) => (!params.industry || company.industryName === params.industry) && (!query || [company.companyName,company.representativeName,company.businessNumber,company.mainProducts,company.address,company.roadAddress,company.industryName].some((value)=>normalize(value).includes(query))));
    rows = [...rows].sort(params.sort === "revenue-desc" ? (a,b)=>(b.revenueKrwMillion??-1)-(a.revenueKrwMillion??-1) : params.sort === "recent-desc" ? (a,b)=>normalize(b.lastCollectedAt).localeCompare(normalize(a.lastCollectedAt)) : (a,b)=>a.companyName.localeCompare(b.companyName,"ko"));
    const total = rows.length, totalPages = Math.max(1,Math.ceil(total/params.pageSize)), page = Math.min(Math.max(1,params.page),totalPages);
    return { rows:rows.slice((page-1)*params.pageSize,page*params.pageSize),total,page,totalPages };
  }
  async getDetail(companyId: string): Promise<CompanyDetail> { const detail=details.get(companyId); if(!detail) throw new Error("기업을 찾을 수 없습니다."); return detail; }
  async listIndustries(): Promise<IndustryOption[]> { return [...new Set(companies.map((x)=>x.industryName).filter(Boolean))].sort((a,b)=>a!.localeCompare(b!,"ko")).map((name)=>({id:name!,name:name!})); }
}
