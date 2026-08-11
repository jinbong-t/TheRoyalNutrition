const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldStr1 = '<button class="btn" style="width: 110px; height: 110px; border-radius: 50%; font-size: 3.5rem; background: #3b82f6; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;" onclick="checkR6OX(\\\'O\\\')">⭕</button>';
const oldStr2 = '<button class="btn" style="width: 110px; height: 110px; border-radius: 50%; font-size: 3.5rem; background: #ef4444; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;" onclick="checkR6OX(\\\'X\\\')">❌</button>';

const newStr1 = '<button style="width: 90px; height: 90px; border-radius: 20px; font-size: 4rem; font-weight: bold; font-family: \'Arial\', sans-serif; background: white; color: #3b82f6; border: 4px solid #3b82f6; box-shadow: 0 4px 10px rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="checkR6OX(\\\'O\\\')">O</button>';
const newStr2 = '<button style="width: 90px; height: 90px; border-radius: 20px; font-size: 4rem; font-weight: bold; font-family: \'Arial\', sans-serif; background: white; color: #ef4444; border: 4px solid #ef4444; box-shadow: 0 4px 10px rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="checkR6OX(\\\'X\\\')">X</button>';

html = html.replace(oldStr1, newStr1).replace(oldStr2, newStr2);
fs.writeFileSync('index.html', html, 'utf8');
console.log("Replaced successfully!");
