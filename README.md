# Purchase Order Management System

## Tech Stack
- Backend: FastAPI, PostgreSQL
- Frontend: HTML, CSS, Bootstrap, JavaScript

## Features
- Create Purchase Order
- View all Purchase Orders
- Update PO Status
- Delete PO
- Auto calculation with 5% tax

## How to Run

### Backend
```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary
python -m uvicorn main:app --reload

### Frontend
1. Open `frontend/index.html` in your browser.
2. Make sure backend is running at `http://localhost:8000`.
3. Use the dashboard to view all POs.
4. Use the "Create PO" page to add new purchase orders.

### Database
- Import `database.sql` into PostgreSQL before running the backend.
- This contains tables for vendors, products, purchase orders, and items.
