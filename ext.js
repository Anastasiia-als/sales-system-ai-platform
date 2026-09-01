const fs = require('fs');

function extractAndWrite(inFile, outFile) {
    let text = fs.readFileSync(inFile, 'utf8');
    let startIdx = text.indexOf('-Value "');
    if (startIdx === -1) startIdx = text.indexOf('-Value \"');
    if (startIdx === -1) return console.log('Could not find -Value in', inFile);
    startIdx += 8;
    let endIdx = text.lastIndexOf('"');
    if (endIdx === -1 || endIdx <= startIdx) endIdx = text.lastIndexOf('\'');
    let content = text.substring(startIdx, endIdx);
    
    content = content.replace(/\\`/g, '`');
    
    fs.writeFileSync(outFile, content, 'utf8');
    console.log('Wrote', outFile);
}

extractAndWrite('scratch/orig_global.txt', 'js/portal/ui/portal-global-automation-view.js');
extractAndWrite('scratch/orig_rule.txt', 'js/portal/ui/portal-rule-builder-ui.js');
