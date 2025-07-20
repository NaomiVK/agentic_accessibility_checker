#!/bin/bash
echo "========================================"
echo "Autonomous Accessibility Testing"
echo "with Claude Vision Analysis"
echo "========================================"
echo ""
echo "This test will:"
echo "1. Scan pages with axe-core"
echo "2. Identify complex issues"
echo "3. Use Claude Code SDK + Playwright MCP for vision analysis"
echo "4. Generate comprehensive reports"
echo ""

# Load environment variables
export NODE_ENV=development

# Run the test
node dist/test-autonomous-vision.js