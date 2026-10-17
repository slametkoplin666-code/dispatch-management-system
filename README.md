# Dispatch Management System

Starter modular berbasis Node.js + Express, React + Vite, SQLite, JWT, RBAC, dashboard WO, distribusi WO, portal Leader/Installer, Text-to-Table, dan WhatsApp Cloud API opsional.

## Persyaratan
- Node.js 20+
- npm

## Jalankan lokal
1. Salin `server/.env.example` menjadi `server/.env`.
2. Isi `JWT_SECRET` dengan secret acak minimal 32 karakter.
3. Untuk membuat Super Admin pertama kali, isi `BOOTSTRAP_ADMIN_EMAIL` dan `BOOTSTRAP_ADMIN_PASSWORD` (minimal 12 karakter) di `server/.env`. Tidak ada kredensial bawaan.
4. Dari root: `npm install`, `npm run install:all`, lalu `npm run dev`.
5. Frontend: http://localhost:5173 ; API: http://localhost:4000/api/health

Setelah admin pertama dibuat, hapus variabel bootstrap dari environment deployment. Jangan commit `.env`, token, database produksi, atau data pelanggan nyata.

## Role
- `SUPER_ADMIN`: membuat akun Dispatch dan Leader.
- `DISPATCH`: mengelola WO dan distribusi.
- `LEADER`: melihat WO sesuai kontraktor, membuat Installer, assign WO kontraktornya.
- `INSTALLER`: melihat WO yang ditugaskan dan melaporkan progres.

## Batasan starter
Text-to-Table saat ini menggunakan parser label/alias berbasis aturan, bukan LLM generatif. WhatsApp tidak mengirim pesan sebelum variabel API terisi. Sebelum produksi, tambahkan test otomatis, rate limiting, monitoring, backup, kebijakan retensi, HTTPS, dan peninjauan keamanan.
