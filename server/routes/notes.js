const { reportError } = require('../utils/logger');
const express = require('express');
const crypto = require('crypto');
const { noteUpload, imageExtensions } = require('../middleware/uploads');
const { bodyFields, text, validateId } = require('../middleware/validation');
const { classNumber, classVariants, canReadNote, deliveryType, publicNote } = require('../utils/noteAccess');
const auth = require('../middleware/auth');
const Note = require('../models/Note');
const { noteFolder } = require('../utils/noteStorage');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

router.param('id', validateId);

/**
 * GET /api/notes/:id/download
 * Generate a time-limited signed download link for restricted files and return JSON.
 * Enforces JWT authentication to ensure only authorized users can request download links.
 */
router.get('/:id/download', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note || !canReadNote(req, note)) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    // A legacy public URL is not an authorization mechanism.
    if (!note.publicId) {
      return res.status(409).json({ message: 'This legacy note must be re-uploaded before it can be downloaded securely.' });
    }

    const isImage = imageExtensions.has(note.fileType.toLowerCase());
    
    // Generate signed URL bypassing any delivery blocks
    const signedUrl = cloudinary.utils.private_download_url(note.publicId, note.fileType.toLowerCase(), {
      public_id: note.publicId,
      type: deliveryType(note),
      resource_type: isImage ? 'image' : 'raw',
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 300 // Five-minute download grant.
    });

    res.json({ downloadUrl: signedUrl });
  } catch (error) {
    reportError(error, 'generate_download_url_error', req);
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
    const filter = req.userRole === 'student' ? { class: { $in: classVariants(req.user.studentClass) } } : {};
    const notes = await Note.find(filter)
      .select('-fileUrl -publicId')
      .populate('uploadedBy', 'name batchName')
      .sort({ createdAt: -1 }).lean();
    res.json(notes);
  } catch (error) {
    reportError(error, 'fetch_notes_error', req);
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
        const isImage = imageExtensions.has(note.fileType.toLowerCase());
        const resourceType = isImage ? 'image' : 'raw';
        const result = await cloudinary.uploader.destroy(note.publicId, { resource_type: resourceType, type: deliveryType(note), invalidate: true });
        if (!['ok', 'not found'].includes(result?.result)) throw new Error('Storage deletion did not complete.');
      } catch (cloudinaryErr) {
        reportError(cloudinaryErr, 'failed_to_delete_cloudinary_asset', req);
        return res.status(502).json({ message: 'Could not delete the stored file. Please retry; your note is still available.' });
      }
    }

    // Delete from MongoDB notes collection
    await Note.findByIdAndDelete(note._id);
    res.json({ message: 'Note deleted successfully.' });
  } catch (error) {
    reportError(error, 'delete_note_error', req);
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
router.post('/', ...noteUpload, bodyFields({ displayName: text(200), class: text(10),
  subject: text(80), description: text(2000) }), async (req, res) => {
  try {
    const { displayName, class: grade, subject, description } = req.body;
    
    if (!displayName?.trim() || classNumber(grade) === null ||
        !Note.schema.path('subject').enumValues.includes(subject)) {
      return res.status(400).json({ message: 'Display name, class, and subject are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a file to upload.' });
    }

    const teacherId = req.userId;

    // Convert file size
    const fileSizeStr = formatBytes(req.file.size);

    // Extract file type/extension
    const ext = req.file.verifiedExtension.toUpperCase();

    // Determine Cloudinary resource_type: 'image' for images, 'raw' for documents/others
    const isImage = imageExtensions.has(ext.toLowerCase());
    const resourceType = isImage ? 'image' : 'raw';

    // Sanitize filename to prevent URL encoding issues with special characters (+, spaces, parenthesis)
    const assetName = `${crypto.randomUUID()}${resourceType === 'raw' ? `.${ext.toLowerCase()}` : ''}`;

    const folder = noteFolder({ class: grade, subject, uploadedBy: teacherId });
    const cloudinaryResult = await cloudinary.uploadStreamToCloudinary(req.file.buffer, {
      type: 'authenticated', resource_type: resourceType, public_id: `${folder}/${assetName}`,
      ...(process.env.CLOUDINARY_FOLDER_MODE !== 'fixed' ? { asset_folder: folder, display_name: displayName.trim() } : {}),
      overwrite: false,
    });

    // Save note metadata in MongoDB
    let note;
    try { note = await Note.create({
      displayName,
      class: grade,
      subject,
      description: description || '',
      uploadedBy: teacherId,
      fileUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      fileSize: fileSizeStr,
      fileType: ext,
    }); } catch (error) {
      // Do not leave a new file orphaned if metadata validation/storage fails.
      try { await cloudinary.uploader.destroy(cloudinaryResult.public_id, { resource_type: resourceType, type: 'authenticated' }); }
      catch (cleanupError) { reportError(cleanupError, 'orphaned_note_cleanup_failed', req); }
      throw error;
    }

    // Populate and return
    const populatedNote = await Note.findById(note._id).populate('uploadedBy', 'name batchName');

    res.status(201).json(publicNote(populatedNote));
  } catch (error) {
    reportError(error, 'upload_note_error', req);
    res.status(500).json({ message: 'Server error uploading file. Please try again.' });
  }
});

module.exports = router;
