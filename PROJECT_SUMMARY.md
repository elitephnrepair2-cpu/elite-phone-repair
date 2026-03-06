# Elite Phone Repair CRM - Comprehensive Project Summary

This project is a React/Vite-based Point-of-Sale, Ticketing, and CRM application tailored for a phone repair shop ("Elite Phone Repair"). The backend is powered entirely by Supabase for authentication, database storage, and edge functions. 

The application is structured around a central Dashboard that allows shop technicians to manage customers and repair "Tickets," and an iPad "Kiosk" mode optimized for customer intake.

## Tech Stack
*   **Frontend:** React (TypeScript), Vite
*   **Styling:** Tailwind CSS (utility-first, responsive design heavily utilized for iPad vs. Desktop views)
*   **Backend / Database:** Supabase (PostgreSQL)
*   **Hosting Context:** Local development via Vite (`npm run dev`)

---

## 🚀 Key Features Implemented

### 1. iPad Customer Intake Kiosk (`KioskView.tsx`)
*   **Purpose:** A full-screen, streamlined UI for customers walking into the shop to check themselves in and create a preliminary repair ticket.
*   **Dynamic Device Selection:** Replaced a generic text input with dependent dropdown menus (Brand -> Model). 
    *   Powered by a massive internal dataset (`constants/devices.ts`) covering 10+ years of phones, tablets, and laptops from Apple, Samsung, Google, Motorola, OnePlus, and LG.
    *   Includes a fallback "Other" text input if the brand/model isn't found.
*   **Repair Type Question:** Customers select what repair they need (Screen, Battery, Back Glass, etc.) from a dropdown powered by `REPAIR_CATEGORIES`.
*   **Form Cleanups:** Removed legacy UI clutter like the Promo Code field; updated label names for clarity (e.g., "Alternative Phone Number").
*   **Data Flow:** Submits a payload to `App.tsx` containing name, phone, device specifics, problem description, repair category, and marketing consent (capturing IP and form version).

### 2. Automated Internal Quoting System (`prices.ts`)
*   **Purpose:** To prevent manual price lookups and standardizing quoting across the shop.
*   **Pricing Matrix:** Implemented a massive, nested TypeScript dictionary mapping `[Brand] -> [Model] -> [Repair Category]` to a specific dollar amount (e.g., `Apple -> iPhone 16 Pro -> Screen = $140 / $220`).
*   **Calculation:** When the Kiosk submits a ticket, `App.tsx` intercepts the device and repair type, queries the `REPAIR_PRICES` dictionary, and calculates the `estimated_cost` before inserting the row into Supabase.

### 3. Technician Shop Dashboard (`App.tsx` & `KanbanBoard.tsx`)
*   **Kanban Workflow:** The primary view for active repairs is a native HTML5 Drag-and-Drop Kanban Board. Tickets can be dragged between *In Queue*, *Diagnosing*, *Repairing*, and *Completed* columns, instantly updating the Supabase database.
*   **Quick Actions:** Technicians can click a "Mark Paid" toggle directly on the Kanban cards to update the ticket's `is_paid` status without opening the full ticket view.
*   **View Switching State Machine:** The app avoids React Router and uses a strict internal string state (`view = 'dashboard' | 'kiosk' | 'view_ticket'`) to render content, passing data down as props.

### 4. Detailed Ticket View (`TicketView.tsx`)
*   **Admin Visibility:** Displays customer info, problem description, and the new **"Automatic System Quote"**. This quote is intentionally hidden from the customer-facing Kiosk and only visible here.
*   **Print Styles:** Includes embedded `@media print` CSS so technicians can physically print the ticket with shop warranty terms stripped of nav buttons.

---

## 🗄️ Database Architecture (Supabase)

### Table: `customers`
*   `id` (UUID, Primary Key)
*   `name`, `phone`, `email`, `alt_phone`
*   `location` (String, used for multi-store filtering)
*   `marketing_sms_consent` (Bool), `marketing_sms_consent_at` (Timestamp)
*   `consent_ip`, `consent_source`

### Table: `tickets`
*   `id` (UUID, Primary Key)
*   `customer_id` (UUID, Foreign Key)
*   `device` (String, e.g., "Apple iPhone 15 Pro Max")
*   `problem_description` (Text)
*   `status` (String, e.g., 'In Queue'. Added via `supabase_migration_status.sql`)
*   `is_paid` (Bool)
*   `price` (Numeric)
*   `repair_type` (String, e.g., 'Screen'. Added via `supabase_migration_quotes.sql`)
*   `estimated_cost` (String, e.g., '$140 / $220'. Added via `supabase_migration_quotes.sql`)

---

## 🛑 Current State & Context
We just finished implementing the automated pricing logic and refining the Kiosk intake flow. The app builds perfectly without warnings. 

The developer should be aware that all state management across views (Dashboard -> Kanban -> Kiosk -> Settings) is handled centrally in `App.tsx` via standard React hooks rather than a state management library like Redux or React Router.
