
with open('patch_automation_ui3.js', 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()
c = c.replace('<!-- Modals -->\' + ';', '<!-- Modals -->')
with open('patch_automation_ui3.js', 'w', encoding='utf-8') as f:
    f.write(c)

