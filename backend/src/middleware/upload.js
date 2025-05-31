import multer from "multer";

const storage = multer.memoryStorage(); // using memory for Cloudinary upload

const upload = multer({
    storage,
    limits: {
        fileSize: 8 * 1024 * 1024 // 8 MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});
