# GlucoTrack Pro — Personal Blood Sugar Monitoring & Analysis Dashboard

A modern, responsive, privacy-first web application designed for personal blood sugar management, real-time clinical analysis, longitudinal glycemic trend tracking, and automated clinical report generation.

Built entirely frontend-only with **React**, **TypeScript**, **Tailwind CSS**, **Recharts**, **SheetJS (xlsx)**, **jsPDF**, and browser-native **IndexedDB** & **LocalStorage**. **No external databases, no servers, and zero cloud tracking.**

---

## Key Features

### 1. Interactive Clinical Dashboard
- **Comprehensive Glycemic KPIs**: Total Readings, Average Fasting, Average Non-Fasting, Latest Reading, Lowest Recorded, Highest Recorded, and Normal/Elevated/High count distributions.
- **Dynamic Recharts Visualizations**:
  - **Sequential Glucose Trends (Line Chart)** with configurable reference threshold lines.
  - **Fasting vs. Non-Fasting Comparison (Grouped Bar Chart)**.
  - **Monthly Glycemic Averages (Bar Chart)**.
  - **Classification Distribution (Donut / Pie Chart)**.
- **Flexible Timeframe Filtering**: Filter by Today, Last 7 Days, Last 30 Days, This Month, Last Month, All Time, or Custom Date Ranges.

### 2. Manual Reading Entry with Real-Time Feedback
- Record measurements with **Date**, **Time**, **Blood Sugar Level**, **Reading Type**, **Meal Information**, and **Notes / Symptoms**.
- **Reading Types**: Fasting, Before Meal, 1 Hour After Meal, 2 Hours After Meal, Random / Casual.
- **Instant Clinical Analysis Preview**: As you type, the system provides live color-coded classification, clinical explanations, previous reading comparison (+/- difference), and actionable dietary/lifestyle recommendations.
- **Quick Timing Presets**: One-click entry presets for Fasting Morning, 2h Post-Breakfast, 2h Post-Lunch, 2h Post-Dinner, and Random checks.

### 3. Standards-Based Clinical Range Evaluation
- **General Reference Screening Defaults** (clearly distinguished from individualized treatment targets):
  - **Fasting**: Normal (70–99 mg/dL), Prediabetes screening (100–125 mg/dL), Diabetes screening (126+ mg/dL).
  - **2-Hour Post-Meal**: Normal (< 140 mg/dL), Elevated (140–199 mg/dL), Screening range (200+ mg/dL).
  - **Random / Casual**: Contextual interpretation without applying inappropriate fasting criteria.
- **Diagnosed Diabetes Management Targets (ADA Preset)**: Fasting 80–130 mg/dL, Post-meal < 180 mg/dL.
- **Medical Disclaimer**: Visible throughout the dashboard, reports, and exported documents to emphasize that algorithm outputs are informational and do not replace personalized physician guidance.

### 4. Reading History & Log Management
- Searchable data table with full-text search across notes, meals, and symptoms.
- Multi-criteria filtering by reading type, status (Normal, Elevated, High, Low), and date range.
- Multiple sorting options: Newest First, Oldest First, Sugar Level High-to-Low, Low-to-High.
- Comprehensive modal with in-depth clinical analysis and previous reading comparison.
- Full Edit and Delete workflows with confirmation dialogues.
- Batch selection for multi-record export or deletion.

### 5. In-Depth Glycemic Analytics
- **Estimated HbA1c (%)**: Calculated using the international ADAG formula (`A1c = (mean_glucose + 46.7) / 28.7`).
- **Glycemic Variability**: Standard Deviation (SD) and Coefficient of Variation (CV %) to evaluate glucose fluctuations against the clinical stability goal ($\le 36\%$).
- **Time in Range (TIR %)**: Multi-segment breakdown adhering to international consensus tiers (Very Low $<54$, Low $54-69$, In Range $70-180$, High $181-250$, Very High $>250$ mg/dL).
- **Time of Day Distribution**: Morning (06–12), Afternoon (12–18), Evening (18–22), and Night (22–06).
- **Day of Week Patterns**: Compare weekday vs. weekend glycemic profiles.

### 6. Automated Reports & Exporting
- Generate reports for **Daily**, **Weekly**, **Monthly**, or **Custom Date Ranges**.
- Includes automatic clinical summary commentary, percentage distributions, and prior-period trend comparisons.
- **Export Options**:
  - **Excel Report (.xlsx)**: Styled multi-worksheet workbook powered by SheetJS.
  - **PDF Report (.pdf)**: Clinical document generated via jsPDF and jspdf-autotable, formatted with summary KPI boxes, distribution statistics, reading history table, and medical disclaimer.
  - **Print Layout**: Dedicated `@media print` styling for clean physical printing or browser PDF saving.

### 7. Excel Import & Multi-Format Backups
- **Import Excel Files (.xlsx, .xls)**:
  - Automatically identifies columns (Date, Time, Blood Sugar, Reading Type, Notes, Meal).
  - Pre-import preview table showing valid rows, invalid entries, and detected duplicates.
  - User confirmation dialog before persisting data.
- **Notepad / Plain Text Backup (.txt)**: Formatted, human-readable ASCII journal.
- **CSV Export (.csv)**: Clean comma-separated values compatible with all spreadsheet tools.
- **Full JSON Backup & Restore**: Download complete encrypted snapshot of all database records and user configurations.
- **Backup Reminder**: Alerts user if significant new data has been logged without a backup.

### 8. Custom Configuration & Settings
- Switch between **mg/dL** and **mmol/L** with automatic dynamic conversion across all historical records and inputs.
- Custom target threshold adjustments for Fasting, 1h Post-Meal, 2h Post-Meal, Random, and Hypoglycemia limit.
- Configurable maximum storage limit (default 1,000 readings) with optional auto-deletion of oldest records.
- Light and Dark mode toggle.
- 1-Click **Load 14-Day Realistic Sample Data** to explore all features instantly.

---

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **Icons**: Lucide React
- **Data Visualization**: Recharts
- **Storage**: Browser IndexedDB (for reading records) & LocalStorage (for application preferences)
- **Spreadsheet Processing**: SheetJS (`xlsx`)
- **Document Generation**: jsPDF + jspdf-autotable
- **Build Tool**: Vite

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone or download the repository:
   ```bash
   git clone https://github.com/your-username/gluco-track-pro.git
   cd gluco-track-pro
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

4. Build for production:
   ```bash
   npm run build
   ```
   The compiled assets will be output to the `dist/` directory.

5. Preview the production build locally:
   ```bash
   npm run preview
   ```

---

## Deployment to GitHub Pages

The application is configured to deploy directly to GitHub Pages:

### Method 1: Automatic Deployment via GitHub Actions (Recommended)
1. Push your code to the `main` branch of your GitHub repository.
2. In your repository on GitHub, navigate to **Settings > Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish your dashboard.

### Method 2: Manual Deployment with `gh-pages`
1. Install `gh-pages`:
   ```bash
   npm install --save-dev gh-pages
   ```
2. Add the following scripts to `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Run:
   ```bash
   npm run deploy
   ```

---

## Privacy & Security

GlucoTrack Pro operates **exclusively in your browser**:
- No accounts, logins, or tracking cookies.
- No medical data is sent over the internet.
- Storage resides in your browser's **IndexedDB** database.
- Use the **JSON Backup** feature in the Import / Export section regularly to preserve your records across devices.

---

## Medical Disclaimer

GlucoTrack Pro is intended for personal informational monitoring and health tracking only. It does not provide medical diagnoses, treatment decisions, or replace consultation with a licensed physician or certified diabetes care and education specialist.

