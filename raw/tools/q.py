import json,datetime as dt,glob
def L(f):
    r=json.load(open(f))['chart']['result'][0]
    q=r['indicators']['quote'][0]; adj=r['indicators'].get('adjclose',[{}])[0].get('adjclose')
    rows=[]
    for i,t in enumerate(r['timestamp']):
        d=dt.datetime.utcfromtimestamp(t+7*3600).date().isoformat()
        rows.append((d,q['close'][i],q['volume'][i],adj[i] if adj else None,q['open'][i],q['high'][i],q['low'][i]))
    ev=r.get('events',{})
    return r['meta'],rows,ev
_,ix,_=L('t_JKSE.json'); ixd={r[0] for r in ix if r[1] and r[0]>='2010-01-01'}
for f in ['tBBCA_JK.json','tBBRI_JK.json','tTLKM_JK.json','tASII_JK.json','tBMRI_JK.json','t_JKSE.json']:
    m,rows,ev=L(f); rows=[r for r in rows if r[0]>='2010-01-01']
    days=[r[0] for r in rows]; dup=len(days)-len(set(days))
    nulls=sum(1 for r in rows if r[1] is None); zerov=sum(1 for r in rows if r[2]==0)
    good=[r for r in rows if r[1]]
    s=set(r[0] for r in good); miss=len(ixd-s); extra=len(s-ixd)
    jumps=[(good[i][0],round((good[i][1]/good[i-1][1]-1)*100,1)) for i in range(1,len(good)) if abs(good[i][1]/good[i-1][1]-1)>0.12]
    flat=0; run=0
    for i in range(1,len(good)):
        run = run+1 if good[i][1]==good[i-1][1] else 0
        flat=max(flat,run)
    spl=[(dt.datetime.utcfromtimestamp(v['date']).date().isoformat(),v['splitRatio']) for v in ev.get('splits',{}).values()]
    divs=sorted(dt.datetime.utcfromtimestamp(v['date']).date().isoformat()[:4] for v in ev.get('dividends',{}).values())
    print(f"\n{f[1:-5]} {m.get('currency')} rows {len(rows)} dup {dup} null {nulls} vol0 {zerov} missVsIHSG {miss} extraVsIHSG {extra} longestFlatRun {flat}")
    print("  first",good[0][:2],"last",good[-1][:2],"mult",round(good[-1][1]/good[0][1],2), "adj mult", round(good[-1][3]/good[0][3],2) if good[0][3] else '-')
    print("  splits",sorted(spl)); print("  div years",sorted(set(divs)),"count",len(divs))
    print("  jumps>12%",jumps[:20])
