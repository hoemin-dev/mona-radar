import argparse
import json
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs, unquote
from . import company, certification, forecast, facility, market
from .db import ROOT, FILES
from .live import LiveService

MODULES={'company':company,'certification':certification,'forecast':forecast,'facility':facility,'market':market}
live=LiveService()

class LocalHTTPServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR permits two servers to receive the same port's traffic.
    allow_reuse_address=False

    def server_bind(self):
        if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()

def dispatch(path,p):
    if path=='/api/health':
        return {'status':'ok','databases':{d:(ROOT/'db_local'/f).is_file() for d,f in FILES.items()}}
    if path=='/api/live': return live.overview()
    if path=='/api/live/targets/search': return live.search_targets(p.get('q',''))
    if path=='/api/live/status': return live.status()
    if path=='/api/companies': return company.search(p)
    if path=='/api/industries': return company.options()['industries']
    if path.startswith('/api/companies/'): return company.detail(unquote(path.removeprefix('/api/companies/')))
    parts=path.strip('/').split('/')
    if len(parts)>=2 and parts[0]=='api' and parts[1] in MODULES:
        module=MODULES[parts[1]]
        if len(parts)==2: return module.search(p)
        if len(parts)==3 and parts[2]=='options': return module.options()
        if len(parts)==3:
            return module.detail(unquote(parts[2]),p.get('mode','bid')) if parts[1]=='market' else module.detail(unquote(parts[2]))
    raise LookupError('경로를 찾을 수 없습니다.')

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send_json(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False,allow_nan=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)

    def trusted(self):
        host=urlsplit('http://'+self.headers.get('Host','')).hostname
        origin=self.headers.get('Origin')
        allowed={'127.0.0.1','localhost','[::1]','::1'}
        return host in allowed and (not origin or urlsplit(origin).hostname in allowed)

    def do_GET(self):
        if not self.trusted(): return self.send_json({'error':'로컬 접근만 허용합니다.'},403)
        url=urlsplit(self.path); params={k:v[-1] for k,v in parse_qs(url.query,keep_blank_values=True).items()}
        try: self.send_json(dispatch(url.path,params))
        except LookupError as error:self.send_json({'error':str(error)},404)
        except (ValueError,TypeError) as error:self.send_json({'error':str(error)},400)
        except Exception as error:self.send_json({'error':str(error)},503)

    def do_POST(self):
        if not self.trusted(): return self.send_json({'error':'로컬 접근만 허용합니다.'},403)
        if not self.headers.get('Content-Type','').startswith('application/json'): return self.send_json({'error':'JSON 요청이 필요합니다.'},415)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0 <= size <= 8192: raise ValueError('요청 크기를 확인하세요.')
            payload=json.loads(self.rfile.read(size) or b'{}')
            if self.path=='/api/company/metadata': return self.send_json(company.save_metadata(payload))
            if self.path=='/api/live/scan': return self.send_json(live.scan(background=True),202)
            if self.path=='/api/live/targets/delete': return self.send_json(live.delete_target(payload))
            if self.path=='/api/live/targets': return self.send_json(live.add_target(payload),201)
            if self.path=='/api/live/settings': return self.send_json(live.settings(payload))
            self.send_json({'error':'경로를 찾을 수 없습니다.'},404)
        except (ValueError,TypeError,AttributeError) as error:self.send_json({'error':str(error)},400)
        except Exception as error:self.send_json({'error':str(error)},503)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8787);args=parser.parse_args()
    server=LocalHTTPServer(('127.0.0.1',args.port),Handler)
    live.start()
    print(f'MIDWAY API http://127.0.0.1:{args.port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:live.stop.set();server.server_close()

if __name__=='__main__': main()
