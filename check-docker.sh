#!/bin/bash

echo "Checking for Docker installation..."
echo ""

# Check if Docker Desktop app exists
if [ -d "/Applications/Docker.app" ]; then
    echo "✅ Docker Desktop app is installed at /Applications/Docker.app"
    echo ""
    echo "Checking if Docker daemon is running..."
    
    # Try to run docker command
    if command -v docker &> /dev/null; then
        echo "✅ Docker command is available"
        docker --version
        echo ""
        if docker info &> /dev/null; then
            echo "✅ Docker daemon is running"
            docker info | grep "Server Version"
        else
            echo "❌ Docker Desktop is installed but not running"
            echo ""
            echo "👉 Please open Docker Desktop from Applications"
            echo "   Wait for it to show 'Docker Desktop is running' in the menu bar"
        fi
    else
        echo "⚠️  Docker app exists but command not in PATH"
        echo ""
        echo "Try running this to add Docker to your PATH:"
        echo "export PATH=\"/Applications/Docker.app/Contents/Resources/bin:\$PATH\""
        echo ""
        echo "Or restart your terminal after opening Docker Desktop"
    fi
else
    echo "❌ Docker Desktop is not installed"
    echo ""
    echo "Install it from: https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "After installation:"
    echo "1. Open Docker Desktop from Applications"
    echo "2. Wait for it to start (icon appears in menu bar)"
    echo "3. Run this check script again"
fi
