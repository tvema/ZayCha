import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Multer setup for avatars and files
export const uploadDir = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let originalName = file.originalname;
    try {
      originalName = decodeURIComponent(originalName);
    } catch(e) {
      try {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      } catch (e2) {}
    }
    
    // Sanitize extension and block dangerous extensions
    const ext = path.extname(originalName).toLowerCase();
    const dangerousExtensions = ['.js', '.mjs', '.ts', '.tsx', '.sh', '.exe', '.bat', '.cmd', '.php', '.py', '.pl', '.rb', '.jar', '.html', '.htm', '.svg'];
    if (dangerousExtensions.includes(ext)) {
      return cb(new Error('Недопустимый формат файла (исполняемые и скриптовые файлы запрещены)'), '');
    }

    cb(null, 'file-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  let originalName = file.originalname;
  try {
    originalName = decodeURIComponent(originalName);
  } catch(e) {}
  
  const ext = path.extname(originalName).toLowerCase();
  const dangerousExtensions = ['.js', '.mjs', '.ts', '.tsx', '.sh', '.exe', '.bat', '.cmd', '.php', '.py', '.pl', '.rb', '.jar', '.html', '.htm', '.svg'];
  
  if (dangerousExtensions.includes(ext)) {
    return cb(new Error('Недопустимый формат файла (исполняемые файлы заблокированы)'), false);
  }
  
  cb(null, true);
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

