const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
const Attendance = require('./models/Attendance');
const Counter = require('./models/Counter');
const PasswordRequest = require('./models/PasswordRequest');
const FeePayment = require('./models/FeePayment');
const connectDB = require('./config/db');

async function seed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for seeding MyAcademy Portal database...');

    // 1. Seed Admin
    const existingAdmin = await Admin.findOne({ email: 'admin@myacademy.com' });
    if (existingAdmin) {
      console.log('Admin account already exists. Skipping Admin seed.');
    } else {
      await Admin.create({
        name: 'Admin User',
        email: 'admin@myacademy.com',
        password: 'admin123',
        phone: '0300-0000000',
        profilePicture: '',
      });
      console.log('✅ Default Admin account created:');
      console.log('   Email: admin@myacademy.com');
      console.log('   Password: admin123');
    }

    // 2. Seed Default Teacher
    let teacher = await Teacher.findOne({ email: 'teacher@myacademy.com' });
    if (teacher) {
      console.log('Teacher account already exists. Skipping Teacher seed.');
    } else {
      teacher = await Teacher.create({
        name: 'Prof. Sarah Jenkins',
        email: 'teacher@myacademy.com',
        phone: '0321-9876543',
        batchName: 'Computer Science',
        password: 'teacher123',
        profilePicture: '',
      });
      console.log('✅ Default Teacher account created:');
      console.log('   Email: teacher@myacademy.com');
      console.log('   Password: teacher123');
    }

    // Clear and reset Student enrollment counters for 2026
    const year = 2026;
    await Counter.deleteOne({ _id: `enrollment_${year}` });
    await Counter.create({ _id: `enrollment_${year}`, seq: 0 });

    // Helper to generate roll number sequentially
    const getNextRollNumber = async (studentClass) => {
      const session = String(year % 100).padStart(2, '0');
      const cls = String(studentClass).padStart(2, '0');
      const counter = await Counter.findOneAndUpdate(
        { _id: `enrollment_${year}` },
        { $inc: { seq: 1 } },
        { new: true }
      );
      const enrollment = String(counter.seq).padStart(2, '0');
      return `MA${session}${cls}${enrollment}`;
    };

    // 3. Clear existing students and attendance for fresh mock data
    await Student.deleteMany({});
    await Attendance.deleteMany({});
    await PasswordRequest.deleteMany({});
    await FeePayment.deleteMany({});

    // Seed Students
    const mockStudents = [
      { name: 'Arsalan Khan', studentClass: '09', fees: 6000, feesPaid: 5500, phone: '0300-1111111', enrollmentDate: new Date('2026-07-01T00:00:00.000Z') },
      { name: 'Aisha Malik', studentClass: '09', fees: 5000, feesPaid: 5000, phone: '0300-2222222', enrollmentDate: new Date('2026-07-01T00:00:00.000Z') },
      { name: 'Zain Ali', studentClass: '09', fees: 5500, feesPaid: 2000, phone: '0300-3333333', enrollmentDate: new Date('2026-07-01T00:00:00.000Z') },
      { name: 'Fatima Ahmed', studentClass: '09', fees: 6000, feesPaid: 6000, phone: '0300-4444444', enrollmentDate: new Date('2026-08-01T00:00:00.000Z') },
      { name: 'Bilal Siddiqui', studentClass: '09', fees: 5000, feesPaid: 0, phone: '0300-5555555', enrollmentDate: new Date('2026-08-01T00:00:00.000Z') },
    ];

    const seededStudents = [];
    for (const studData of mockStudents) {
      const rollNumber = await getNextRollNumber(studData.studentClass);
      const s = await Student.create({
        ...studData,
        rollNumber,
        assignedTeacher: teacher._id,
        password: 'student123',
      });
      seededStudents.push(s);
    }
    console.log(`✅ Seeded ${seededStudents.length} mock students assigned to Sarah Jenkins.`);

    // 4. Seed Attendance Records for the last 5 days
    const today = new Date();
    const statuses = ['present', 'present', 'present', 'absent', 'leave']; // probabilities

    for (let offset = 4; offset >= 0; offset--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - offset);
      targetDate.setHours(0, 0, 0, 0);
      const dateStr = targetDate.toISOString().split('T')[0];

      const records = seededStudents.map((s, idx) => {
        // distribute status somewhat predictably
        let status = 'present';
        if (offset === 1 && idx === 2) status = 'absent'; // Zain was absent yesterday
        if (offset === 2 && idx === 4) status = 'leave'; // Bilal was on leave 2 days ago
        if (offset === 3 && idx === 1) status = 'absent'; // Aisha was absent 3 days ago

        return {
          student: s._id,
          teacher: teacher._id,
          date: targetDate,
          status,
        };
      });

      await Attendance.insertMany(records);
      console.log(`   Seeded class attendance for date: ${dateStr}`);
    }

    // 5. Seed Fee Payments for August 2026 (Month index 7)
    const feeMonth = 7;
    const feeYear = 2026;
    const feePayments = [
      { student: seededStudents[0]._id, teacher: teacher._id, month: feeMonth, year: feeYear, status: 'submitted' },
      { student: seededStudents[1]._id, teacher: teacher._id, month: feeMonth, year: feeYear, status: 'submitted' },
      { student: seededStudents[3]._id, teacher: teacher._id, month: feeMonth, year: feeYear, status: 'submitted' },
    ];
    await FeePayment.insertMany(feePayments);
    console.log('✅ Seeded FeePayment records for August 2026.');

    console.log('✅ Seed complete. Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
