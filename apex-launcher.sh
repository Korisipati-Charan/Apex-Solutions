#!/bin/bash
# Apex Solutions - Standalone Launcher for macOS/Linux
# This script ensures dependencies are ready and boots the binary environment.

echo "🚀 Booting Apex Solutions Standalone Environment..."

# Check for node
if ! command -v node &> /dev/null
then
    echo "❌ Node.js not found. Please install Node.js to run this standalone build."
    exit
fi

# Build production assets if missing
if [ ! -d "dist" ]; then
    echo "📦 Initializing production assets..."
    npm install && npm run build
fi

echo "✨ Synthesis Complete. System Core Starting..."
npm run start
