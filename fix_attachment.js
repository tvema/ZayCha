import fs from 'fs';

let content = fs.readFileSync('components/FileAttachment.tsx', 'utf8');

const isDocStr = "['application/pdf'].includes(fileData.mime) || fileData.mime?.includes('wordprocessingml') || fileData.mime?.includes('spreadsheetml') || fileData.name?.toLowerCase().endsWith('.pdf') || fileData.name?.toLowerCase().endsWith('.docx') || fileData.name?.toLowerCase().endsWith('.xlsx')";

content = content.replace("fileData.mime === 'application/pdf' && (", `${isDocStr} && (`);
content = content.replace("fileData.mime === 'application/pdf' && (", `${isDocStr} && (`);
content = content.replace("fileData.mime === 'application/pdf' && (", `${isDocStr} && (`);
content = content.replace("if (fileData.mime === 'application/pdf') {", `if (${isDocStr}) {`);
content = content.replace("{fileData.mime === 'application/pdf' && !loading && blobUrl && (", `{${isDocStr} && !loading && blobUrl && (`);

// Also update isPdfPreview definition if necessary, but actually we can just let it be since it only controls the thumbnail/image size container stuff for PDF. Wait, if it's a docx/xlsx, it won't have a generated preview image from page 1 yet. Wait, we don't generate thumbnails for docx/xlsx. So keeping `isPdfPreview` just for PDF is correct!
// Oh wait, if `isDocStr` is true for docx, then `isViewerOpen` could be true, which mounts DocumentViewer!

fs.writeFileSync('components/FileAttachment.tsx', content);
console.log('Fixed FileAttachment.tsx');
