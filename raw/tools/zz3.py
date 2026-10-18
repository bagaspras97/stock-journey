import json,datetime as dt,sys
exec(open('zz2.py').read().split("if __name__")[0])
BAD={'TOWR':['2018-05-02','2018-05-04'],'MAPI':['2018-05-02','2018-05-04','2018-05-14'],'FILM':['2025-06-30','2025-07-01','2025-07-02','2025-07-03','2025-07-04']}; START={'ARTO':'2019-01-02','MYOR':'2013-10-22','ANTM':'2012-09-24','AMRT':'2014-01-02','TOWR':'2014-01-02','BNGA':'2011-01-03','BSDE':'2011-01-03'}
def LV(f):
    r=json.load(open(f))['chart']['result'][0]; q=r['indicators']['quote'][0]
    return [(dt.datetime.utcfromtimestamp(t).date().isoformat(),q['close'][i],q['volume'][i]) for i,t in enumerate(r['timestamp'])]
def S3(tk):
    out=[];pv=None
    for d,c,v in LV(f't{tk}_JK.json'):
        dup=pv==(c,v); pv=(c,v)
        if c and v and not dup and '2010-01-01'<=d<='2025-12-31' and d in ix and d not in BAD.get(tk,[]) and d>=START.get(tk,''): out.append((d,c))
    return out
if __name__=='__main__':
  th=float(sys.argv[2])
  for tk in sys.argv[1].split(','):
    rows=S3(tk); d=[r[0] for r in rows]; v=[r[1] for r in rows]; p=zig(v,th)
    print(f"\n## {tk} {v[-1]/v[0]:.2f}x {d[0]} {v[0]:.4g} → {v[-1]:.4g}")
    print("  ".join(f"{d[a]}→{d[b]} {v[a]:.4g}→{v[b]:.4g} {(v[b]/v[a]-1)*100:+.0f}%\n" for a,b in zip(p,p[1:])))
    print("  big", [(d[i],round((v[i]/v[i-1]-1)*100,1)) for i in range(1,len(v)) if abs(v[i]/v[i-1]-1)>0.12][:14])
