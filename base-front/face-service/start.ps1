python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env -ErrorAction SilentlyContinue
uvicorn app:app --host 0.0.0.0 --port 8081 --reload
