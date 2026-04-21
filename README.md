# TUNIFIX full-stack backend with real mail service

This package adds a real Node.js/Express backend for your TUNIFIX site.

## Features
- Client and technician registration/login
- Real SMTP email sending with Nodemailer
- Forgot-password by email
- Password reset endpoint
- Client/technician notifications by email and inside the app
- Request creation / assignment / completion
- Client rating after completed jobs only
- Top-rated technicians endpoint
- Static serving of the website pages

## Quick start
1. Install Node.js 18+
2. Open this folder in terminal
3. Run:
   - `npm install`
   - copy `.env.example` to `.env`
   - fill your SMTP settings
   - `npm start`
4. Open `http://localhost:3000`

## Important
- The frontend already falls back to static demo mode if `/api` is missing.
- Once you run this backend, the real backend is used instead.
- Uploaded request images are kept as base64 in the JSON datastore for simplicity.
- Data is stored in `data/db.json`.

## Main email events
- welcome email after registration
- login alert email
- forgot-password reset email
- request created / updated email to client
- accepted mission email to client and technician
- completed mission email to client and technician
- review published email to client and technician
