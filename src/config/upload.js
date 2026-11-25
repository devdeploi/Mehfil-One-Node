const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const uploadDirs = ['uploads/vendor', 'uploads/mahal', 'uploads/reviews'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = 'uploads/';
        if (req.baseUrl.includes('vendors')) {
            dest += 'vendor';
        } else if (req.baseUrl.includes('mahals')) {
            dest += 'mahal';
        } else if (req.baseUrl.includes('reviews')) {
            dest += 'reviews';
        } else {
            dest += 'others'; // Fallback
        }

        // Ensure directory exists just in case
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (Images, Videos, and PDFs)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only images, videos (MP4/WebM), and PDFs are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 35 * 1024 * 1024 }, // 35MB limit (supports 10MB images and short event video clips)
    fileFilter: fileFilter
});

module.exports = upload;
