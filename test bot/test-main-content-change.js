const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const diff = require('diff');

// Usage: node test-main-content-change.js before.html after.html
if (process.argv.length < 4) {
  console.log('Usage: node test-main-content-change.js <before.html> <after.html>');
  process.exit(1);
}

const beforeFile = process.argv[2];
const afterFile = process.argv[3];

function getMainText(html) {
  const $ = cheerio.load(html);
  let searchRoot = $('main');
  if (searchRoot.length === 0) searchRoot = $('body');
  return searchRoot.text().replace(/\s+/g, ' ').trim();
}

const beforeHtml = fs.readFileSync(beforeFile, 'utf-8');
const afterHtml = fs.readFileSync(afterFile, 'utf-8');

const beforeText = getMainText(beforeHtml);
const afterText = getMainText(afterHtml);

if (beforeText === afterText) {
  console.log('No main content text change detected.');
} else {
  const diffResult = diff.diffWords(beforeText, afterText);
  let diffSummary = '';
  diffResult.forEach(part => {
    if (part.added) diffSummary += `🟩 +${part.value}`;
    else if (part.removed) diffSummary += `🟥 -${part.value}`;
  });
  if (!diffSummary) diffSummary = 'Change detected, but no word-level diff found.';
  console.log('Main content text change detected! Diff summary:');
  console.log(diffSummary);
} 