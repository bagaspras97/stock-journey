exec(open("zz3.py").read().split("if __name__==")[0])
import sys
for tk in sys.argv[1].split(','):
    r=S3(tk); m=max(r,key=lambda x:x[1]); print(tk,'max',m,'last',r[-1])
