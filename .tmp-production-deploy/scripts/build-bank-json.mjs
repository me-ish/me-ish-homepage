import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zengin from 'zengin-code'; // { "0001": { name:"みずほ銀行", kana:"ミズホ", branches:{ "101":{name:"東京...", kana:"トウキョウ..."} } }, ... }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const banks = [];
const branches = {}; // { bankCode: [{code,name,kana}, ...], ... }

for (const [bankCode, bank] of Object.entries(zengin)) {
  banks.push({
    code: bankCode,
    name: bank.name,
    kana: bank.kana,
    aliases: [], // あればここに別名を足す（任意）
  });

  branches[bankCode] = Object.entries(bank.branches || {}).map(([brCode, br]) => ({
    code: brCode,
    name: br.name,
    kana: br.kana,
  }));
}

// 出力先: /public/data
const outDir = path.join(__dirname, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'banks.json'), JSON.stringify(banks, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'branches.json'), JSON.stringify(branches, null, 2), 'utf8');

console.log(`Wrote ${banks.length} banks and ${Object.values(branches).reduce((a,b)=>a+b.length,0)} branches.`);
