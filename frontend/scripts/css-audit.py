#!/usr/bin/env python3
"""CSS audit for the website (read-only; changes nothing).

Reports:
  1. Class names used in className=... that don't exist in the COMPILED CSS
     (i.e. undefined, or purged by Tailwind because they're built from template strings).
  2. Rules inside `@layer components` in globals.css that Tailwind drops because no
     file contains the class as a complete literal (dead CSS, or a dynamic-class bug).
  3. Class names glued to ${...} in template literals (purge risk if the rule is in the layer).
  4. CSS variables used with var(--x) but never defined (no fallback = property ignored).

Usage (from frontend/):  python3 scripts/css-audit.py
Expected false positives: RichTextEditor's `${classPrefix}-wrap` etc., and plain words
like 'all' / 'title' / 'today' that appear inside className ternaries.
"""
import subprocess, tempfile
import re,glob,os,json
TMP=tempfile.mkdtemp()
subprocess.run(['node_modules/.bin/tailwindcss','-c','tailwind.config.js','-i','src/app/globals.css','-o',TMP+'/out.css'],check=True,capture_output=True)
def selectors_classes(css):
    css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
    out=set()
    # take selector parts: text before each '{'
    for m in re.finditer(r'([^{}]+)\{',css):
        sel=m.group(1)
        if sel.strip().startswith('@'): continue
        for c in re.findall(r'\.((?:\\.|[A-Za-z0-9_-])+)',sel):
            out.add(c.replace('\\',''))
    return out
compiled=selectors_classes(open(TMP+'/out.css').read())
src=open('src/app/globals.css').read()
lines=src.split('\n')
start=next(i for i,l in enumerate(lines) if l.startswith('@layer components'))
end=next(i for i,l in enumerate(lines) if 'end @layer components' in l)
layer='\n'.join(lines[start:end])
defined_src=selectors_classes(src)
in_layer=selectors_classes(layer)

used={}  # class -> set(files)
dyn=[]   # template literal with ${ } in class context
def add(tok,f):
    tok=tok.strip()
    if not tok or not re.match(r'^[A-Za-z_-][A-Za-z0-9_:/\[\].%-]*$',tok): return
    used.setdefault(tok,set()).add(f)
def expr_end(s,i):
    depth=0
    for j in range(i,len(s)):
        if s[j]=='{': depth+=1
        elif s[j]=='}':
            depth-=1
            if depth==0: return j
    return len(s)
for f in glob.glob('src/**/*.tsx',recursive=True)+glob.glob('src/**/*.ts',recursive=True):
    s=open(f).read()
    for m in re.finditer(r'className="([^"]*)"',s):
        for t in m.group(1).split(): add(t,f)
    for m in re.finditer(r'className=\{',s):
        e=expr_end(s,m.end()-1); expr=s[m.end():e]
        for q in re.findall(r"'([^'\n]*)'|\"([^\"\n]*)\"",expr):
            for t in (q[0] or q[1]).split(): add(t,f)
        for tl in re.findall(r'`([^`]*)`',expr,flags=re.S):
            inner=re.findall(r"'([^'\n]*)'|\"([^\"\n]*)\"",tl)
            for q in inner:
                for t in (q[0] or q[1]).split(): add(t,f)
            static=re.sub(r'\$\{[^}]*\}',' \x00 ',tl)
            for t in static.split():
                if '\x00' in t: continue
                add(t,f)
            # tokens glued to ${...}: dynamic class names
            for d in re.findall(r'([A-Za-z0-9_-]*[A-Za-z0-9][-_]+)\$\{',tl):  # e.g. badge-${x}; 'chip${cond ? " chip--on" : ""}' is safe
                dyn.append((f,d+'${…}'))
undefined={c:sorted(fs) for c,fs in used.items() if c not in compiled}
purged=sorted(c for c in in_layer if c not in compiled)
print('used',len(used),'compiled classes',len(compiled))
print('UNDEFINED',len(undefined))
for c,fs in sorted(undefined.items()): print(' ',c,'<-',', '.join(x.replace('src/','') for x in fs[:3]), ('+%d'%(len(fs)-3) if len(fs)>3 else ''))
print('PURGED in @layer components (defined, never seen as literal):',len(purged))
print(' ', ' '.join(purged))
print('DYNAMIC class names built from template strings (purge risk):')
for f,d in dyn: print(' ',f.replace('src/',''),d)

defined_vars=set(re.findall(r'(--[A-Za-z0-9-]+)\s*:',src))
print('CSS VARIABLES used but never defined (no fallback = broken):')
for f in sorted(glob.glob('src/**/*.tsx',recursive=True))+['src/app/globals.css']:
    for m in re.finditer(r'var\((--[A-Za-z0-9-]+)\s*(,)?',open(f).read()):
        if m.group(1) not in defined_vars and not m.group(2): print(' ',m.group(1),'<-',f.replace('src/',''))
