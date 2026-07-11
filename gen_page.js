const fs = require('fs');  
const p = 'C:\\Users\\hyl\\Desktop\\NJUVaChampion\\nvc\\app\\tournaments\\[id]\\page.tsx';  
const c = fs.readFileSync(p, 'utf8');  
console.log('current len=' + c.length);  
