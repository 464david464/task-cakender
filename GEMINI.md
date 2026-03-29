# TaskCalendar Moodle Dashboard

## Project Overview
A lightweight, modular dashboard to display Moodle assignments on an old tablet.

## Architecture
- **Backend:** Python (FastAPI) - Lightweight, efficient.
- **Frontend:** Vanilla HTML/CSS/JS - Optimized for low-end hardware.
- **Tablet:** Dedicated Samsung Tablet running a lightweight Custom ROM (LineageOS GSI).

## Tablet Technical DNA (SM-T515)
- **Model:** Samsung Galaxy Tab A 10.1 (2019) LTE (**SM-T515**).
- **Codename:** `gta3xlxx`.
- **Architecture:** Hybrid (Exynos 7904 64-bit CPU / 32-bit Userland).
- **Kernel/ABI:** `armv8l` / `armeabi-v7a`.
- **Project Treble:** Supported (`ro.treble.enabled=true`).
- **Partitioning:** System-as-Root (**A/B**).
- **Required GSI Type:** **A64** (ARM32_Binder64).
- **GSI Variant needed:** `a64_bvN` (a64 = Arch, b = AB, v = Vanilla, N = No Superuser).

## Progress Log
- [x] Initial project setup.
- [x] Moodle API client with Track identification (Zemax/Manual).
- [x] UI updated with completion tracking (Checkmark & Undo).
- [x] Backend persistence for completed tasks.
- [ ] **Phase 2: Tablet Transformation (In Progress)**
    - [x] Identify exact Tablet Model and DNA (SM-T515 / gta3xlxx).
    - [x] Install flashing tools (Heimdall/ADB) on Linux Mint.
    - [ ] Unlock Bootloader (OEM Unlock + Download Mode).
    - [ ] Flash Custom Recovery (TWRP - gta3xl specific).
    - [ ] Flash Multidisabler (Mandatory for Samsung encryption).
    - [ ] Flash Lightweight ROM (LineageOS 19.1 A64 GSI).
    - [ ] Configure Kiosk Mode for the Dashboard.

## Current State
- Backend & Frontend are functional and persistent.
- Tablet DNA is fully verified via ADB (`armv8l`, `System-as-Root`, `Treble=true`).
- Ready for Bootloader Unlock and Recovery flashing.

## Instructions for Gemini
- **CRITICAL:** This device is a hybrid 32/64-bit. NEVER recommend `arm64` or standard `arm32` images. ONLY `a64` (Binder64) images will work.
- **SAFETY:** Use `Heimdall` for flashing on Linux. Ensure `Multidisabler` is flashed before the first boot of a custom ROM.
- Always verify the model again before providing `Heimdall` flash commands.
