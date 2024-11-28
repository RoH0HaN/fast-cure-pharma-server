import fs from "fs";
import multer from "multer";
import path from "path";

// Ensure the folder exists before saving
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./public/temp";
    // Check if directory exists
    if (!fs.existsSync(dir)) {
      // Create the directory if it doesn't exist
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage: storage });
