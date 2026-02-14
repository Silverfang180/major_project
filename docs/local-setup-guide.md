# Chronicle Local Setup Guide

This guide details how to set up **Chronicle** entirely on your local Windows machine without using Docker.

## 1. Install PostgreSQL
Since your system does not have a database yet, you must install one.

1.  **Download**: Go to the [PostgreSQL Installer for Windows](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2.  **Install**: Run the installer.
    -   **Password**: When prompted to set a password for the `postgres` superuser, remember it (e.g., `password`).
    -   **Port**: Keep the default `5432`.
3.  **Verify**: Open the "SQL Shell (psql)" application from your Start Menu.
    -   Press Enter for Server, Database, Port, and Username to accept defaults.
    -   Type your password when asked.
    -   If you see `postgres=#`, you are connected.

## 2. Create the Database
You need a specific database named `chronicle` for the app.

1.  Open **SQL Shell (psql)** (if not already open).
2.  Run the following command:
    ```sql
    CREATE DATABASE chronicle;
    ```
3.  Verify by typing `\l` to list databases. You should see `chronicle` in the list.
4.  Type `\q` to quit.

## 3. Configure the Application
You need to tell the Python application how to connect to your local database.

1.  Open the file `.env` in the project root (`c:\Users\Admin\Downloads\chronicle\.env`).
2.  Find the `DATABASE_URL` line. It currently points to `db` (the Docker container).
3.  **Update it** to point to `localhost`.
    -   **Current**: `DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/chronicle`
    -   **New**: `DATABASE_URL=postgresql+asyncpg://postgres:YourPassword@localhost:5432/chronicle`
    *(Replace `YourPassword` with the password you set in Step 1).*
4.  Do the same for `ALEMBIC_DATABASE_URL` (remove the `+asyncpg` part if present, or just ensure the host is `localhost`):
    -   **New**: `ALEMBIC_DATABASE_URL=postgresql://postgres:YourPassword@localhost:5432/chronicle`

## 4. Install Dependencies
(If you haven't already)

1.  Open your terminal in `c:\Users\Admin\Downloads\chronicle`.
2.  Activate your virtual environment:
    ```powershell
    .venv\Scripts\Activate.ps1
    ```
3.  Install strict dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## 5. Initialize the Database (Migrations)
Now that the app can connect, you need to create the tables.

1.  Run the migration command:
    ```bash
    alembic upgrade head
    ```
    *If successful, you will see output indicating tables have been created (e.g., `Running upgrade... -> ...`).*

## 6. Run the Application
1.  Start the server:
    ```bash
    uvicorn main:app --reload
    ```
2.  **Success**: You should see:
    ```
    INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
    ```

### Troubleshooting
-   **"Connection refused"**: Check if the PostgreSQL service is running in Windows Services (`services.msc`).
-   **"Module not found"**: Ensure your `.venv` is activated.
