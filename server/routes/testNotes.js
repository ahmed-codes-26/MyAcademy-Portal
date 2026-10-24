const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { bodyFields, text, dateOnly, integer, validateId } = require('../middleware/validation');
const TestNote = require('../models/TestNote');

const router = express.Router();
router.use(auth, requireRole('teacher'));
router.param('id', validateId);
const scope = (req) => ({ owner: req.userId, ownerRole: req.userRole });
const fields = { date: dateOnly, title: text(120), content: text(20000), pinned: (v) => typeof v === 'boolean' };
const publicFields = '_id date title content pinned createdAt updatedAt';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Dates stay in calendar order when a note is edited. Pagination never silently drops notes.
router.get('/', async (req, res, next) => {
  try {
    const { q = '', date, page = '1' } = req.query;
    if (typeof q !== 'string' || q.length > 120 || (date !== undefined && !dateOnly(date)) ||
        !integer(page, 1, 100000)) return res.status(400).json({ message: 'Invalid search or date.' });
    const filter = scope(req);
    if (date) filter.date = date;
    const search = q.trim();
    if (search) {
      const dateMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(search);
      const dateSearch = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : search;
      filter.$or = [{ date: { $regex: escapeRegex(dateSearch), $options: 'i' } },
        { title: { $regex: escapeRegex(search), $options: 'i' } },
        { content: { $regex: escapeRegex(search), $options: 'i' } }];
    }
    const notes = await TestNote.find(filter).select(publicFields)
      .sort({ pinned: -1, date: -1, createdAt: -1, _id: -1 }).skip((Number(page) - 1) * 50).limit(51).lean();
    res.json({ notes: notes.slice(0, 50), hasMore: notes.length > 50 });
  } catch (error) { next(error); }
});

router.post('/', bodyFields(fields), async (req, res, next) => {
  try {
    if (!dateOnly(req.body.date) || !(req.body.title?.trim() || req.body.content?.trim())) {
      return res.status(400).json({ message: 'Choose a date and write a note.' });
    }
    const note = await TestNote.create({ ...req.body, ...scope(req) });
    res.status(201).json(await TestNote.findById(note._id).select(publicFields).lean());
  } catch (error) { next(error); }
});

router.put('/:id', bodyFields(fields), async (req, res, next) => {
  try {
    const note = await TestNote.findOne({ _id: req.params.id, ...scope(req) });
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    Object.assign(note, req.body);
    if (!(note.title.trim() || note.content.trim())) return res.status(400).json({ message: 'Write a note before saving.' });
    await note.save();
    res.json(await TestNote.findById(note._id).select(publicFields).lean());
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const note = await TestNote.findOneAndDelete({ _id: req.params.id, ...scope(req) });
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    res.json({ message: 'Note deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;
