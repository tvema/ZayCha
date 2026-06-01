import fs from 'fs';

let content = fs.readFileSync('components/FileAttachment.tsx', 'utf8');

const badStr = "['application/pdf'].includes(fileData.mime) || fileData.mime?.includes('wordprocessingml') || fileData.mime?.includes('spreadsheetml') || fileData.name?.toLowerCase().endsWith('.pdf') || fileData.name?.toLowerCase().endsWith('.docx') || fileData.name?.toLowerCase().endsWith('.xlsx')";

const goodStr = "(['application/pdf'].includes(fileData.mime) || fileData.mime?.includes('wordprocessingml') || fileData.mime?.includes('spreadsheetml') || fileData.name?.toLowerCase().endsWith('.pdf') || fileData.name?.toLowerCase().endsWith('.docx') || fileData.name?.toLowerCase().endsWith('.xlsx'))";

content = content.replaceAll(badStr, goodStr);

fs.writeFileSync('components/FileAttachment.tsx', content);
console.log('Fixed spacing/parens');
