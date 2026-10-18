import json,datetime as dt,sys
exec(open('zz2.py').read().split("if __name__")[0])
def S(tk):
    r=json.load(open(f'../px/d_{tk}.json'))['chart']['result'][0]; q=r['indicators']['quote'][0]
    return [(dt.datetime.utcfromtimestamp(t).date().isoformat(),q['close'][i]) for i,t in enumerate(r['timestamp']) if q['close'][i] and '2010-01-01'<=dt.datetime.utcfromtimestamp(t).date().isoformat()<='2025-12-31']
th=float(sys.argv[2])
for tk in sys.argv[1].split(','):
    rows=S(tk); d=[r[0] for r in rows]; v=[r[1] for r in rows]; p=zig(v,th)
    print(f"\n## {tk} {v[-1]/v[0]:.2f}x {d[0]} {v[0]:.4g} → {v[-1]:.4g} max {max(rows,key=lambda x:x[1])}")
    print("  ".join(f"{d[a]}→{d[b]} {v[a]:.4g}→{v[b]:.4g} {(v[b]/v[a]-1)*100:+.0f}%\n" for a,b in zip(p,p[1:])))
    m=sorted([(d[i],round((v[i]/v[i-1]-1)*100,1)) for i in range(1,len(v))],key=lambda x:x[1])
    print("  down",m[:4],"up",m[-4:])
