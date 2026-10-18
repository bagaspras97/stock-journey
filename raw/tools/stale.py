exec(open("zz3.py").read().split("if __name__==")[0])
import sys,collections
for tk in sys.argv[1].split(','):
    r=[x for x in LV(f't{tk}_JK.json') if x[1] and x[2] and '2010'<=x[0]<='2025-12-31' and x[0] in ix]
    c=collections.Counter(); n=collections.Counter()
    for a,b in zip(r,r[1:]):
        y=b[0][:4]; n[y]+=1
        if a[1]==b[1] and a[2]==b[2]: c[y]+=1
    print(tk,' '.join(f"{y}:{c[y]}" for y in sorted(n) if c[y]))
