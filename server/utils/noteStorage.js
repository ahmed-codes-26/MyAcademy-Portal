const { PRIVATE_NOTE_FOLDER, classNumber } = require('./noteAccess');

function noteFolder(note) {
  const grade = String(classNumber(note.class)).padStart(2, '0');
  const subject = note.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${PRIVATE_NOTE_FOLDER}/class-${grade}/${subject}/teacher-${note.uploadedBy}`;
}

module.exports = { noteFolder };
