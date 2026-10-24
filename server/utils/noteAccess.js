const PRIVATE_NOTE_FOLDER = 'myacademy_notes_private';
function classNumber(value) {
  const match = typeof value === 'string' && value.trim().match(/^(\d{1,2})(?:th|st|nd|rd)?$/i);
  return match ? Number(match[1]) : null;
}
function classVariants(value) {
  const number = classNumber(value);
  return number === null ? [] : [...new Set([String(number), String(number).padStart(2, '0'),
    `${number}th`, `${number}st`, `${number}nd`, `${number}rd`, value.trim()])];
}
function canReadNote(req, note) {
  if (req.userRole === 'admin' || req.userRole === 'teacher') return true;
  const grade = classNumber(req.user?.studentClass);
  return req.userRole === 'student' && grade !== null && grade === classNumber(note.class);
}
function deliveryType(note) {
  return note.publicId?.startsWith(`${PRIVATE_NOTE_FOLDER}/`) ? 'authenticated' : 'upload';
}
function publicNote(note) {
  const object = note.toObject ? note.toObject() : { ...note };
  delete object.fileUrl;
  delete object.publicId;
  return object;
}
module.exports = { PRIVATE_NOTE_FOLDER, classNumber, classVariants, canReadNote, deliveryType, publicNote };
