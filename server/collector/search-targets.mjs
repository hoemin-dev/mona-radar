import { KonepsClient } from './vendor/koneps/client.js';
import { planCollectorTargetSearch, responseItems } from './vendor/koneps/target-search.js';
import { DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION } from './vendor/koneps/endpoints.js';
export async function searchTargets(query,client) {
  const {params}=planCollectorTargetSearch(query);
  const found=new Map();let seen=0;
  for(let page=1;page<=100;page++) {
    const response=await client.request(DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION,{...params,pageNo:page});
    const items=responseItems(response.parsedJson);
    for(const row of items){const code=String(row.dtilPrdctClsfcNo||''),name=String(row.dtilPrdctClsfcNoNm||'').trim();if(/^[0-9]{10}$/.test(code)&&name)found.set(code,{code,name});}
    seen+=items.length;
    if(seen>=Number(response.envelope.totalCount??items.length))return [...found.values()].sort((a,b)=>a.code.localeCompare(b.code));
    if(!items.length)throw new Error('검색 결과를 모두 불러오지 못했습니다.');
  }
  throw new Error('검색 결과가 너무 많습니다. 검색어를 구체적으로 입력하세요.');
}
if(process.argv[1]?.endsWith('search-targets.mjs')) {
  try {
    let input='';for await(const chunk of process.stdin)input+=chunk;
    const {query}=JSON.parse(input);
    const client=new KonepsClient({config:{serviceKey:process.env.KONEPS_SERVICE_KEY||process.env.KONEPS_API_KEY,serviceKeyMode:process.env.KONEPS_SERVICE_KEY_MODE==='encode'?'encode':'preserve',timeoutMs:15000,maxRetries:1,baseBackoffMs:500}});
    process.stdout.write(JSON.stringify(await searchTargets(query,client)));
  }catch {process.stderr.write('나라장터 Target 검색에 실패했습니다. 인증키와 연결 상태를 확인하세요.');process.exitCode=1;}
}
