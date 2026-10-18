exec(open("zz3.py").read().split("if __name__==")[0])
import sys
J={d:c for d,c in jk} if 'jk' in dir() else {}
for tk in sys.argv[1].split(','):
    r=S3(tk); m=[(r[i][0],(r[i][1]/r[i-1][1]-1)*100) for i in range(1,len(r))]
    m.sort(key=lambda x:x[1])
    print(tk,'DOWN',[(d,round(p,1)) for d,p in m[:5]],'UP',[(d,round(p,1)) for d,p in m[-5:]])
