RUN:
Backend:
cd apps/api-gateway
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

Frontend:
cd apps/web-ui
npm install
npm run dev

Docker:
docker compose -f ../../deployments/docker/docker-compose.yml up --build
