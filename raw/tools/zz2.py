import json,datetime as dt,sys
def L(f):
    r=json.load(open(f))['chart']['result'][0]; q=r['indicators']['quote'][0]
    return [(dt.datetime.utcfromtimestamp(t).date().isoformat(),q['close'][i]) for i,t in enumerate(r['timestamp'])]
ix={d for d,c in L('t_JKSE.json') if c}
IX=[(d,c) for d,c in L('t_JKSE.json') if c and d>='2010-01-01']
def S(tk):
    rows=[(d,c) for d,c in L(f't{tk}_JK.json') if c and d>='2010-01-01' and d in ix]
    if tk=='TLKM': rows=[r for r in rows if r[0]!='2011-03-23']
    if tk=='BBRI': rows=[(d,c*(0.97571/0.909072) if d<'2021-09-08' else c) for d,c in rows]
    return rows
def zig(v,th):
    piv=[0]; hi=lo=0; trend=0
    for i in range(1,len(v)):
        if trend>=0:
            if v[i]>v[hi]: hi=i
            if v[i]<v[hi]*(1-th) and (trend==1 or hi>0): piv.append(hi); trend=-1; lo=i; continue
        if trend<=0:
            if v[i]<v[lo]: lo=i
            if v[i]>v[lo]*(1+th) and (trend==-1 or lo>0): piv.append(lo); trend=1; hi=i
    piv.append(len(v)-1); out=[]; [out.append(p) for p in piv if not out or p!=out[-1]]; return out
if __name__=='__main__':
  for tk in sys.argv[1].split(','):
    rows=S(tk) if tk!='JKSE' else IX; d=[r[0] for r in rows]; v=[r[1] for r in rows]
    p=zig(v,float(sys.argv[2]))
    print(f"\n## {tk} {v[-1]/v[0]:.2f}x")
    print("  ".join(f"{d[a]}→{d[b]} {v[a]:.0f}→{v[b]:.0f} {(v[b]/v[a]-1)*100:+.0f}%\n" for a,b in zip(p,p[1:])))
    big=[(d[i],round((v[i]/v[i-1]-1)*100,1)) for i in range(1,len(v)) if abs(v[i]/v[i-1]-1)>0.07]
    print("  big days",big)
