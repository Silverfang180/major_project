#!/bin/bash

echo "🚀 Building and starting Chronicle..."
# Build and start services in the background
docker-compose up -d --build

echo "⏳ Waiting for the database to be ready..."
# A short, simple wait for the DB to initialize
sleep 10

echo "▶️ Applying database migrations..."
# Execute the command to apply migrations inside the 'web' container
docker-compose exec web alembic upgrade head

echo "✅ Chronicle is ready to go!"
echo "📖 API Docs: http://localhost:8000/docs"
echo "🗄️ Database Admin: http://localhost:8080"