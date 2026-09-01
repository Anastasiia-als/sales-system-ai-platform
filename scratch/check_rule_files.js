const fs = require('fs');
const files = fs.readdirSync('scratch').filter(f => f.startsWith('test_phase6c_'));
files.forEach(f => {
    let code = fs.readFileSync('scratch/' + f, 'utf8');
    if(code.includes("'Rule'")) console.log(f + " has Rule");
});
