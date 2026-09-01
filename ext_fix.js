const fs = require('fs');
let text = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');
const tables = text.match(/<thead>[\\s\\S]*?<\/thead>/g)->{
  text = text.replace(tables[0], '<thead>\n<tr>\n<th>Статус</th>\n<th>Назва правила</th>\n<th>Scope</�h>\n<th>Тригер</th>\n<th>Умови</th>\n<th>Дії</th>\n<th style="width: 140px; text-align:right;">Керування</th>\n</tr>\n</thead>');
  text = text.replace(tables[1], '<thead>\n<tr>\n<th>Час виконаннѓ</th>\n<th>Правило</th>\n<th>Проєякт (Scope)</th>\n<th>Тригер події</th>\n<th>Статус виконання</th>\n<th>Деталі / Помилка</th>\n</tr>\n</thead>');
  fs.writeFileSync('js/portal/ui/portal-global-automation-view.js', text, 'utf8');
}();
console.log('Fixed');