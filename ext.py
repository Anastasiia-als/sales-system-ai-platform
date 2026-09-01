
import sys
def fix(in_f, out_f):
    with open(in_f, 'r', encoding='utf-8') as f:
        t = f.read()
    if '-Value \'' in t:
        s = t.index('-Value \'') + 8
        e = t.rindex('\'')
        c = t[s:e]
        c = c.replace('\'\'', '\'')
        with open(out_f, 'w', encoding='utf-8') as f:
            f.write(c)
        print('Wrote', out_f)
    else:
        # orig_auto.txt might be just raw code if it was from replace_file_content!
        with open(out_f, 'w', encoding='utf-8') as f:
            f.write(t)
        print('Wrote raw to', out_f)

fix('scratch/orig_global.txt', 'js/portal/ui/portal-global-automation-view.js')
fix('scratch/orig_rule.txt', 'js/portal/ui/portal-rule-builder-ui.js')
fix('scratch/orig_auto.txt', 'js/portal/ui/portal-automation-view.js')

