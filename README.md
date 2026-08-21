# MyAcademy Portal

A comprehensive, full-stack academy management system built with the MERN stack (MongoDB, Express.js, React, Node.js). This portal streamlines administrative tasks, enhances teacher-student communication, and provides centralized hubs for attendance, fees, notes, and automated WhatsApp messaging.

## 🚀 Features

* **Role-Based Access Control:** Dedicated, secure dashboards and routing for Admins, Teachers, and Students.
* **Live WhatsApp Integration:** Automated WhatsApp messaging system linked directly to the academy's communication workflow, complete with session management and authentication helpers.
* **Attendance & Fee Tracking:** Intuitive interfaces for teachers to log student attendance and monitor fee payment statuses.
* **Academic Resource Management:** Cloudinary integration for seamless uploading, storing, and sharing of class notes and resources.
* **Analytics & Stats:** Dashboard metrics to track academy performance, student counts, and active sessions.
* **Secure Authentication:** JWT-based login system with password request/reset flows.

## 🛠️ Tech Stack

**Frontend (Client)**
* React.js (Vite)
* React Router DOM (Protected Routes)
* Context API (State Management)
* Axios (API Client)
* CSS / Tailwind (Styling)

**Backend (Server)**
* Node.js & Express.js
* MongoDB & Mongoose (Database & Modeling)
* Cloudinary (Media/Document Storage)
* WhatsApp-Web.js (WhatsApp Client Integration)
* JSON Web Tokens (Authentication)

## 📁 Repository Structure

The repository is structured into a standard client-server monorepo:

```text
MyAcademy-Portal/
├── client/                 # React Frontend (Vite)
│   ├── public/             # Static assets (Favicons, Logos)
│   ├── src/
│   │   ├── api/            # Axios configurations
│   │   ├── components/     # Reusable UI components (Navbars, Modals, Forms)
│   │   ├── context/        # AuthContext and state providers
│   │   └── pages/          # View components (Dashboards, Login, WhatsApp, Stats)
│   └── package.json        # Frontend dependencies
│
├── server/                 # Node.js / Express Backend
│   ├── config/             # DB and Cloudinary setup
│   ├── middleware/         # Auth protection middleware
│   ├── models/             # Mongoose schemas (Admin, Student, Teacher, Attendance, etc.)
│   ├── routes/             # Express API routes
│   └── utils/              # WhatsApp Managers & Auth Helpers
│   ├── seed.js             # Database seeding script
│   ├── server.js           # Entry point
│   └── package.json        # Backend dependencies
│
└── samples/                # HTML/UI reference templates
