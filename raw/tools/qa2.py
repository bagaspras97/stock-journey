import json,datetime as dt,sys
def L(f):
    r=json.load(open(f))['chart']['result'][0]; q=r['indicators']['quote'][0]
    rows=[(dt.datetime.utcfromtimestamp(t).date().isoformat(),q['close'][i],q['volume'][i]) for i,t in enumerate(r['timestamp'])]
    return rows, r.get('events',{})
ixr,_=L('t_JKSE.json'); ixd=[d for d,c,v in ixr if c and d>='2010-01-01']; ixs=set(ixd); ixm={d:c for d,c,v in ixr if c}
def qa(tk):
    rows,ev=L(f't{tk}_JK.json'); rows=[r for r in rows if r[1] and '2010-01-01'<=r[0]<='2025-12-31' and r[0] in ixs]
    spl=sorted((dt.datetime.utcfromtimestamp(v['date']).date().isoformat(),v['splitRatio']) for v in ev.get('splits',{}).values())
    def fac(d):
        k=1.0
        for sd,ratio in spl:
            a,b=map(float,ratio.split(':'))
            if d<sd: k*=a/b
        return k
    raw=[(d,c*fac(d)) for d,c,v in rows]
    nonint=[d for d,r in raw if abs(r-round(r))>1e-3]
    # segments where non-integer stops
    trans=[]
    for i in range(1,len(raw)):
        a=abs(raw[i-1][1]-round(raw[i-1][1]))>1e-3; b=abs(raw[i][1]-round(raw[i][1]))>1e-3
        if a and not b: trans.append(raw[i][0])
    # suspensions: gaps in trading vs IHSG after first date
    first=rows[0][0]; have={r[0] for r in rows}; gaps=[]; run=[]
    for d in ixd:
        if d<first: continue
        if d not in have: run.append(d)
        else:
            if len(run)>=5: gaps.append((run[0],run[-1],len(run)))
            run=[]
    if len(run)>=5: gaps.append((run[0],run[-1],len(run)))
    jumps=[]
    for i in range(1,len(rows)):
        c=rows[i][1]/rows[i-1][1]-1
        if abs(c)>0.25:
            ix=(ixm.get(rows[i][0],0)/ixm.get(rows[i-1][0],1)-1)*100 if rows[i-1][0] in ixm else None
            jumps.append((rows[i][0],round(c*100,1)))
    vol0=sum(1 for r in rows if r[2]==0)
    print(f"{tk}: {rows[0][0]} {rows[0][1]:.0f} → {rows[-1][0]} {rows[-1][1]:.0f} = {rows[-1][1]/rows[0][1]:.2f}x | n {len(rows)} vol0 {vol0}")
    print(f"   splits {spl} | non-int rows {len(nonint)} transitions {trans[:6]}")
    if gaps: print("   suspensions(≥5d):", gaps[:6])
    if jumps: print("   jumps>25%:", jumps[:10], ("+%d more"%(len(jumps)-10) if len(jumps)>10 else ""))
for tk in sys.argv[1:]: qa(tk)
