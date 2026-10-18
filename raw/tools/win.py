exec(open("zz3.py").read().split("if __name__==")[0])
import sys
tk,a,b=sys.argv[1],sys.argv[2],sys.argv[3]
for d,c,v in LV(f't{tk}_JK.json'):
    if a<=d<=b: print(d,c,v, '' if d in ix else 'NOT-IDX')
