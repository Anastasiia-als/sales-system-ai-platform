
const fs = require('fs');
let content = fs.readFileSync('js/portal/ui/portal-automation-view.js', 'utf8');
content = content.replace('<!-- Modals -->' + ';', '<!-- Modals -->');
const splitToken = '<div class=\' + 'flex justify-end gap-2 mt-6\' + '>\r\n            <button class=\' + 'btn btn-outline\' + ' id=\' + 'btn-cancel-rule\' + '>\u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438</button>\r\n            <button class=\' + 'btn btn-primary\' + ' id=\' + 'btn-save-rule\' + '>\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438</button>\r\n        </div>\r\n    </div>\r\n</div>';
content = content.replace(splitToken, splitToken + '\r\n    ' + ';\r\n}');
fs.writeFileSync('js/portal/ui/portal-automation-view.js', content);

