# 🚀 DeskPilot

**Smart Downloads Organizer + Duplicate Finder + Rollback + Report Dashboard**

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [CLI Commands](#-cli-commands)
- [Web Dashboard](#-web-dashboard)
- [Design Decisions](#-design-decisions)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Sample Outputs](#-sample-outputs)
- [Contributing](#-contributing)

---

## 🎯 Problem Statement

My system's **Downloads folder** is constantly cluttered with:

- ❌ **Duplicate files** - Same files downloaded multiple times
- ❌ **Random documents** - PDFs, Word docs scattered everywhere
- ❌ **Installers** - .exe, .msi files from software installations
- ❌ **Images/Videos** - Screenshots, downloads, media files mixed together
- ❌ **Old downloads** - Files from months ago wasting disk space

### What I Need:

✅ **Automatically organize downloads** into logical categories  
✅ **Detect and safely remove duplicates** using secure hashing  
✅ **Generate detailed reports** about my files  
✅ **Keep a history of changes** for accountability  
✅ **Support rollback** if something goes wrong  

**DeskPilot** solves all these problems with a powerful CLI and optional web dashboard.

---

## ✨ Features

### 🔍 Smart Scanning
- Recursively scan any directory
- Calculate SHA-256 hashes for accurate duplicate detection
- Extract file metadata (size, dates, extensions)
- Categorize files automatically

### 📁 Intelligent Organization
- Auto-sort files into categories:
  - 📄 Documents (PDF, DOCX, TXT, etc.)
  - 🖼️ Images (JPG, PNG, GIF, etc.)
  - 🎬 Videos (MP4, MKV, AVI, etc.)
  - 🎵 Audio (MP3, WAV, FLAC, etc.)
  - 📦 Installers (EXE, MSI, DMG, etc.)
  - 🗜️ Archives (ZIP, RAR, 7Z, etc.)
  - 💻 Code (JS, TS, PY, etc.)
  - 📁 Others
- **Dry-run mode** to preview changes
- Collision handling for duplicate filenames

### 🔄 Duplicate Removal
- SHA-256 hash-based detection (no false positives)
- Multiple strategies:
  - `keep-latest` - Keep most recently modified
  - `keep-oldest` - Keep original file
  - `keep-largest` - Keep largest file
- Move to trash (recoverable) or permanent delete

### ⏪ Rollback Support
- Every operation is recorded as a transaction
- Full rollback capability to undo changes
- Transaction history in database

### 📊 Comprehensive Reports
- Total files and disk usage
- Duplicate statistics
- Category breakdown
- Recent activity log
- Space savings calculations

### 🖥️ Web Dashboard
- Real-time statistics
- Visual category breakdown
- Transaction history with rollback buttons
- Scan history

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Interface                           │
│  (Commander.js - scan, organize, dedupe, rollback, report)      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                            │
│  ┌──────────┐ ┌───────────┐ ┌────────┐ ┌──────────┐ ┌────────┐  │
│  │ Scanner  │ │ Organizer │ │Deduper │ │ Rollback │ │Reporter│  │
│  └──────────┘ └───────────┘ └────────┘ └──────────┘ └────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Utility Layer                            │
│  ┌──────┐ ┌────────────┐ ┌────────┐ ┌────────┐                  │
│  │ Hash │ │ Categorize │ │fsSafe  │ │ Logger │                  │
│  └──────┘ └────────────┘ └────────┘ └────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      MongoDB                              │  │
│  │  ┌──────┐  ┌────────────┐  ┌─────────────┐                │  │
│  │  │Scans │  │FileRecords │  │Transactions │                │  │
│  │  └──────┘  └────────────┘  └─────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Prerequisites

- **Node.js 18+** (recommended: 20+)
- **MongoDB 6.0+** running locally or remote
- **npm** or **yarn**

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd deskpilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   # Copy example config
   cp .env.example .env
   
   # Edit .env with your settings
   # MONGODB_URI=mongodb://localhost:27017/deskpilot
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Start MongoDB** (if not running):
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:7
   
   # Or start your local MongoDB service
   ```

---

## 🖥️ CLI Commands

### Scan Directory

Scan a directory to detect files and duplicates:

```bash
# Scan Downloads folder (default)
npm run cli -- scan

# Scan specific directory
npm run cli -- scan /path/to/directory

# Non-recursive scan
npm run cli -- scan /path --no-recursive
```

**Output:**
- Summary table with total files, size, duplicates
- Category breakdown
- Duplicate groups with potential space savings

---

### Organize Files

Organize files into category folders:

```bash
# Preview organization (dry-run)
npm run cli -- organize /path/to/directory --dry-run

# Actually organize files
npm run cli -- organize /path/to/directory

# Include subdirectories
npm run cli -- organize /path --recursive
```

**Created Folders:**
```
target-directory/
├── Documents/
├── Images/
├── Videos/
├── Audio/
├── Installers/
├── Archives/
├── Code/
└── Others/
```

---

### Remove Duplicates

Find and remove duplicate files:

```bash
# Preview duplicates (dry-run)
npm run cli -- dedupe /path --dry-run

# Remove duplicates (keep latest)
npm run cli -- dedupe /path --strategy=keep-latest

# Keep oldest files
npm run cli -- dedupe /path --strategy=keep-oldest

# Keep largest files
npm run cli -- dedupe /path --strategy=keep-largest

# Permanently delete (skip trash)
npm run cli -- dedupe /path --permanent
```

---

### Rollback Changes

Undo a previous operation:

```bash
# List rollbackable transactions
npm run cli -- transactions

# Rollback a specific transaction
npm run cli -- rollback <transaction-id>
```

---

### Generate Report

View comprehensive statistics:

```bash
npm run cli -- report
```

**Report includes:**
- Overview statistics
- Category breakdown
- Duplicate statistics
- Recent activity

---

## 🌐 Web Dashboard

Start the web dashboard (uses your configured port, defaults to **3006**):

```bash
npm run dev
# then open http://localhost:3006/dashboard
```

### Dashboard Features:
- **Control Panel** to run **Scan / Organize / Dedupe** with custom path, dry-run toggle, and dedupe strategy
- **Overview cards** - Total scans, files, duplicates, space saved
- **Category breakdown** - Visual distribution of file types
- **Duplicate stats** - Groups, wasted space, top extensions
 - **Transaction history** - Rollback any organize/dedupe in one click
- **Recent scans** - Latest scans with paths and duplicate counts

### Control Panel Options (front-end triggers server-side jobs)
- **Path**: leave empty to use the default Downloads folder from `.env`
- **Dry Run**: preview organize/dedupe without changing files
- **Dedupe Strategy**: `keep-latest` | `keep-oldest` | `keep-largest`

### API endpoints powering the UI
- `POST /api/scan` – run a scan
- `POST /api/organize` – organize files
- `POST /api/dedupe` – remove duplicates
- `POST /api/transactions/:id/rollback` – rollback an operation
- `GET /api/report` – dashboard data

---

## 🎨 Design Decisions

### Why SHA-256 Hashing?

**Problem:** Detecting duplicate files accurately without false positives.

**Solution:** SHA-256 cryptographic hashing provides:
- ✅ **Collision resistance** - Virtually impossible for two different files to have the same hash
- ✅ **Deterministic** - Same file always produces same hash
- ✅ **Fast enough** - Efficient for large files with streaming

**Alternative considered:** File size + name comparison  
**Rejected because:** Different files can have same size/name

---

### Why Transaction Logs?

**Problem:** Operations modify file system; mistakes can cause data loss.

**Solution:** Every operation creates a transaction record containing:
- Type (organize, dedupe, rollback)
- All actions performed (from → to paths)
- Status of each action
- Summary statistics

**Benefits:**
- ✅ **Auditability** - Know exactly what changed
- ✅ **Rollback support** - Undo any operation
- ✅ **Error recovery** - Resume partial operations
- ✅ **Reporting** - Historical statistics

---

### Why Rollback Approach?

**Problem:** Users might accidentally delete important files or organize incorrectly.

**Solution:** Two-tier safety:

1. **Trash folder** - Deleted files move to `.deskpilot-trash` first
2. **Transaction rollback** - Restore files to original locations

**Implementation:**
```typescript
// Every move/delete is recorded
actions: [{
  actionId: string,
  type: 'move' | 'delete',
  from: '/original/path',
  to: '/new/path',
  status: 'completed'
}]
```

Rollback reverses these actions in order.

---

### Why MongoDB Schema Design?

**Requirements:**
- Store scan results efficiently
- Query duplicates by hash
- Track transaction history
- Support reporting aggregations

**Schema Design:**

```
Scan (1) ─────────────< FileRecord (many)
  │
  │  scanId (indexed)
  │
Transaction (standalone)
  │
  └── actions[] (embedded for atomicity)
```

**Indexes:**
- `FileRecord.hash` - Fast duplicate detection
- `FileRecord.scanId` - Retrieve files per scan
- `Transaction.createdAt` - Recent activity
- `Scan.createdAt` - Recent scans

---

## 💾 Database Schema

### Scan Collection

```typescript
{
  scanId: string,          // UUID
  scannedPath: string,     // "/path/to/directory"
  totalFiles: number,
  totalSize: number,       // bytes
  duplicatesCount: number,
  duplicatesSize: number,  // bytes
  categories: {
    Documents: { count: number, size: number },
    Images: { count: number, size: number },
    // ...
  },
  createdAt: Date,
  updatedAt: Date
}
```

### FileRecord Collection

```typescript
{
  scanId: string,          // Reference to Scan
  fileName: string,
  filePath: string,        // Current path
  originalPath: string,    // Path when scanned
  hash: string,            // SHA-256
  extension: string,       // ".pdf"
  category: string,        // "Documents"
  size: number,
  isDuplicate: boolean,
  duplicateOf: string,     // Path of original
  fileCreatedAt: Date,
  fileModifiedAt: Date,
  createdAt: Date
}
```

### Transaction Collection

```typescript
{
  transactionId: string,   // UUID
  type: 'organize' | 'dedupe' | 'rollback',
  status: 'pending' | 'completed' | 'failed' | 'rolled_back',
  actions: [{
    actionId: string,
    type: 'move' | 'delete' | 'restore',
    from: string,
    to: string,
    status: 'pending' | 'completed' | 'failed',
    error?: string,
    fileHash?: string,
    fileSize?: number
  }],
  summary: {
    movedCount: number,
    deletedCount: number,
    restoredCount: number,
    failedCount: number,
    savedBytes: number,
    totalProcessed: number
  },
  targetPath: string,
  dryRun: boolean,
  strategy?: string,
  createdAt: Date,
  completedAt?: Date,
  rolledBackAt?: Date
}
```

---

## 📂 Project Structure

```
deskpilot/
├── cli/
│   ├── index.ts              # CLI entry point (Commander.js)
│   └── commands/
│       ├── scan.ts           # Scan command
│       ├── organize.ts       # Organize command
│       ├── dedupe.ts         # Dedupe command
│       ├── rollback.ts       # Rollback command
│       └── report.ts         # Report command
├── src/
│   ├── config/
│   │   ├── db.ts             # MongoDB connection
│   │   └── env.ts            # Environment config
│   ├── models/
│   │   ├── Scan.ts           # Scan model
│   │   ├── FileRecord.ts     # FileRecord model
│   │   └── Transaction.ts    # Transaction model
│   ├── services/
│   │   ├── scanner.ts        # File scanning logic
│   │   ├── organizer.ts      # File organization logic
│   │   ├── deduper.ts        # Duplicate detection/removal
│   │   ├── rollback.ts       # Rollback operations
│   │   └── reporter.ts       # Report generation
│   └── utils/
│       ├── hash.ts           # SHA-256 hashing
│       ├── categorize.ts     # File categorization
│       ├── fsSafe.ts         # Safe file operations
│       └── logger.ts         # Colored logging
├── app/                      # Next.js dashboard
│   ├── page.tsx              # Landing page
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard page
│   └── api/
│       ├── report/route.ts
│       ├── scans/route.ts
│       └── transactions/route.ts
├── sample-output/            # Example CLI outputs
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── DEMO_SCRIPT.md
```

---

## 📸 Sample Outputs

See the `sample-output/` directory for:

- `scan-output.txt` - Example scan command output
- `organize-output.txt` - Example organize command output
- `dedupe-output.txt` - Example dedupe command output
- `report-output.txt` - Example report command output
- `dashboard-screenshot.png` - Dashboard screenshot

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Mongoose](https://mongoosejs.com/) - MongoDB ODM
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Next.js](https://nextjs.org/) - React framework
- [TailwindCSS](https://tailwindcss.com/) - CSS framework

---

**Made with ❤️ for clean Downloads folders everywhere**
#   D e s k P i l o t - - - F l i e - O r g a n i z a r t i o n - P l a t e f o r m  
 