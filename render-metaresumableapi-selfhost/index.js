require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// health‑check endpoint for Render
app.get('/healthz', (req, res) => res.sendStatus(200));

const WAHelper = require("./whatsapp.helper");
const path = require("path");
const multer = require("multer");

// CONFIGURATION
const fileSize = 250; // 250MB
const fileTypes = /jpeg|jpg|png|mp4|pdf/;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * fileSize },
    fileFilter: (req, file, cb) => {
        const ext = fileTypes.test(path.extname(file.originalname).toLowerCase());
        if (ext && file.mimetype) cb(null, true);
        else cb(new Error(`Only ${fileTypes} extensions allowed`), false);
    }
});

// helper to override env from form fields
function overrideEnv(fields) {
  ["PORT","META_API_URI","META_APP_ID","META_ACCESS_TOKEN","META_BUSINESS_ACC_ID","API_KEY"]
    .forEach(k => { if (fields[k] !== undefined) process.env[k] = fields[k]; });
}

// simple API‑key middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token !== process.env.API_KEY) return res.status(401).json({ message: "Unauthorized" });
  next();
});

// UPLOAD MEDIA
app.post('/uploadMedia', (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? `Max file size ${fileSize}MB exceeded`
        : "Something went wrong";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "File is required" });

    overrideEnv(req.body);

    try {
      const session = await WAHelper.RUCreateSession({
        file_length: req.file.size,
        file_name:   req.file.originalname,
        file_type:   req.file.mimetype
      });
      if (session.body.error) throw session.body.error;

      const iupload = await WAHelper.RUInitiateUpload(session.body.id, req.file.buffer);
      if (iupload.body.h) {
        return res.status(200).json({ message: "Uploaded!", body: iupload.body });
      }
      throw iupload.body.error || new Error("Upload failed");
    }
    catch (e) {
      const userMsg = e.error_user_title
        ? `${e.error_user_title} (${e.error_user_msg})`
        : e.message;
      console.error(e);
      return res.status(400).json({ message: userMsg });
    }
  });
});

// CREATE TEMPLATE
app.post('/createTemplate', async (req, res) => {
  overrideEnv(req.body);
  try {
    const template = await WAHelper.createWABANOTemplates(req.body);
    if (template.body.id) return res.status(200).json({ message: "Template Created!", body: template.body });
    throw template.body.error || new Error("Template failed");
  }
  catch (e) {
    const userMsg = e.error_user_title
      ? `${e.error_user_title} (${e.error_user_msg})`
      : e.message;
    console.error(e);
    return res.status(400).json({ message: userMsg });
  }
});

// SERVER LISTEN
const port = process.env.PORT || 3000;
app.listen(port, () => console.info(`Listening on port ${port}`));
