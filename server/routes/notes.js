const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Note = require('../models/Note');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

// Configure multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file limit
});

/**
 * GET /api/notes/:id/download
 * Generate a time-limited signed download link for restricted files and redirect.
 * Enforces JWT authentication to ensure only authorized users can download notes.
 */
router.get('/:id/download', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    // Safety fallback: if publicId is missing (e.g. legacy notes), redirect directly to raw url
    if (!note.publicId) {
      console.warn(`Note ${note._id} publicId is missing. Redirecting to direct file URL.`);
      return res.redirect(note.fileUrl);
    }

    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(note.fileType.toUpperCase());
    
    // Generate signed URL bypassing any delivery blocks
    const signedUrl = cloudinary.utils.private_download_url(note.publicId, note.fileType.toLowerCase(), {
      public_id: note.publicId,
      type: 'upload',
      resource_type: isImage ? 'image' : 'raw',
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
    });

    res.redirect(signedUrl);
  } catch (error) {
    console.error('Generate download URL error:', error);
    res.status(500).json({ message: 'Error generating download URL.' });
  }
});

router.use(auth);

/**
 * GET /api/notes
 * Fetch all shared notes across the academy. Populates the teacher details.
 */
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find({})
      .populate('uploadedBy', 'name batchName')
      .sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    console.error('Fetch notes error:', error);
    res.status(500).json({ message: 'Server error loading notes list.' });
  }
});

// Protect mutation endpoints (upload, delete) - teacher access only
router.use((req, res, next) => {
  if (req.userRole !== 'teacher') {
    return res.status(403).json({ message: 'Forbidden. Teacher access required.' });
  }
  next();
});

/**
 * DELETE /api/notes/:id
 * Delete a study note from MongoDB and its associated asset from Cloudinary.
 * Enforces ownership checks to ensure a teacher can only delete their own note.
 */
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    // Verify uploader ownership
    if (note.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized. You can only delete your own notes.' });
    }

    // Terminate asset on Cloudinary if publicId is present
    if (note.publicId) {
      try {
        const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(note.fileType.toUpperCase());
        const resourceType = isImage ? 'image' : 'raw';
        await cloudinary.uploader.destroy(note.publicId, { resource_type: resourceType });
        console.log(`Cloudinary asset deleted successfully: ${note.publicId}`);
      } catch (cloudinaryErr) {
        console.error(`Failed to delete Cloudinary asset ${note.publicId}:`, cloudinaryErr.message);
        // Fall through to delete from DB anyway so the app state stays clean
      }
    }

    // Delete from MongoDB notes collection
    await Note.findByIdAndDelete(note._id);
    res.json({ message: 'Note deleted successfully.' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Server error deleting note.' });
  }
});

// Helper to format file sizes
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};



/**
 * POST /api/notes
 * Upload a study note directly to Cloudinary and save details in MongoDB notes collection.
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { displayName, class: grade, subject, description } = req.body;
    
    if (!displayName || !grade || !subject) {
      return res.status(400).json({ message: 'Display name, class, and subject are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a file to upload.' });
    }

    const teacherId = req.userId;

    // Convert file size
    const fileSizeStr = formatBytes(req.file.size);

    // Extract file type/extension
    const ext = path.extname(req.file.originalname).toUpperCase().replace('.', '') || 'RAW';

    // Determine Cloudinary resource_type: 'image' for images, 'raw' for documents/others
    const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(ext);
    const resourceType = isImage ? 'image' : 'raw';

    // Sanitize filename to prevent URL encoding issues with special characters (+, spaces, parenthesis)
    const sanitizedName = path.parse(req.file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_');

    // Upload to Cloudinary using upload_stream (ephemeral file system safe)
    const uploadStreamPromise = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'myacademy_notes',
            resource_type: resourceType,
            public_id: `${sanitizedName}_${Date.now()}`,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
    };

    const cloudinaryResult = await uploadStreamPromise();

    // Save note metadata in MongoDB
    const note = await Note.create({
      displayName,
      class: grade,
      subject,
      description: description || '',
      uploadedBy: teacherId,
      fileUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      fileSize: fileSizeStr,
      fileType: ext,
    });

    // Populate and return
    const populatedNote = await Note.findById(note._id).populate('uploadedBy', 'name batchName');

    res.status(201).json(populatedNote);
  } catch (error) {
    console.error('Upload note error:', error);
    res.status(500).json({ message: 'Server error uploading file. Please try again.' });
  }
});

module.exports = router;

// Trigger nodemon reload trigger
