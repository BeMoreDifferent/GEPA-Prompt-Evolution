# Installation Guide

Complete guide for installing and setting up GEPA (Genetic-Pareto) Prompt Evolution.

## 📋 Prerequisites

### System Requirements

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 or **pnpm** >= 7.0.0 (recommended)
- **Git** (for development)
- **OpenAI API Key** (or compatible endpoint)

### Verify Requirements

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check npm version
npm --version   # Should be >= 8.0.0

# Check pnpm version (if using pnpm)
pnpm --version  # Should be >= 7.0.0

# Check Git version
git --version   # Any recent version
```

## 🚀 Installation Methods

### Method 1: No Installation (Recommended)

GEPA runs via `npx` without requiring installation:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run GEPA directly
npx gepa-spo --help
```

**Advantages:**
- ✅ No installation required
- ✅ Always uses the latest version
- ✅ No conflicts with other projects
- ✅ Works immediately

### Method 2: Global Installation

Install GEPA globally for system-wide access:

```bash
# Using npm
npm install -g gepa-spo

# Using pnpm (recommended)
pnpm add -g gepa-spo

# Verify installation
gepa-spo --help
```

**Advantages:**
- ✅ Available system-wide
- ✅ Faster startup (no download each time)
- ✅ Works offline after installation

**Disadvantages:**
- ❌ Requires global installation
- ❌ May conflict with other global packages
- ❌ Requires manual updates

### Method 3: Local Development Installation

For development, contributing, or custom modifications:

```bash
# Clone the repository
git clone https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution.git
cd GEPA-Prompt-Evolution

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run locally
node dist/cli.js --help
```

**Advantages:**
- ✅ Full source code access
- ✅ Can modify and extend functionality
- ✅ Development tools available
- ✅ Run tests and contribute

## 🔧 Environment Setup

### OpenAI API Key

Set your OpenAI API key using one of these methods:

#### Method 1: Environment Variable (Recommended)

```bash
# Linux/macOS
export OPENAI_API_KEY="your-api-key-here"

# Windows (Command Prompt)
set OPENAI_API_KEY=your-api-key-here

# Windows (PowerShell)
$env:OPENAI_API_KEY="your-api-key-here"
```

#### Method 2: .env File

Create a `.env` file in your project directory:

```bash
# .env
OPENAI_API_KEY=your-api-key-here
```

Then load it in your shell:
```bash
# Linux/macOS
source .env

# Windows
# Use a tool like dotenv or set variables manually
```

#### Method 3: CLI Flag

Pass the API key directly to the command:

```bash
npx gepa-spo --api-key "your-api-key-here" --input input.json --config config.json
```

### Custom API Endpoints

If you're using a custom OpenAI-compatible endpoint:

```bash
# Set custom base URL
export OPENAI_BASE_URL="https://your-custom-endpoint.com/v1"

# Or use in config.json
{
  "baseURL": "https://your-custom-endpoint.com/v1"
}
```

## 🧪 Verification

### Quick Test

Run a simple test to verify everything is working:

```bash
# Test basic functionality
npx gepa-spo --help

# Test with minimal example
npx gepa-spo \
  --input ./examples/input.min.prompts.json \
  --config ./examples/config.min.json \
  --log
```

### Expected Output

You should see:
```
GEPA Prompt Optimizer

Usage: gepa [options]

Required Options:
  --input <file>           Input JSON file with prompts and system/modules
  --config <file>          Configuration JSON file
  --api-key <key>          OpenAI API key (or set OPENAI_API_KEY env var)
...
```

## 🔧 Development Setup

### Prerequisites for Development

```bash
# Install Node.js development tools
npm install -g typescript jest

# Install project dependencies
pnpm install

# Install development dependencies
pnpm install --dev
```

### Build Process

```bash
# Build TypeScript to JavaScript
pnpm build

# Watch mode for development
pnpm build:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test tests/cli.test.ts

# Run tests in watch mode
pnpm test --watch
```

## 🐳 Docker Installation

### Using Docker

If you prefer to run GEPA in a container:

```bash
# Build the Docker image
docker build -t gepa-spo .

# Run with Docker
docker run -e OPENAI_API_KEY="your-api-key" \
  -v $(pwd)/data:/app/data \
  gepa-spo \
  --input /app/data/input.json \
  --config /app/data/config.json
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  gepa:
    build: .
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
      - ./runs:/app/runs
    command: ["--input", "/app/data/input.json", "--config", "/app/data/config.json", "--log"]
```

Run with:
```bash
docker-compose up
```

## 🔒 Security Considerations

### API Key Security

- **Never commit API keys** to version control
- **Use environment variables** instead of hardcoding
- **Rotate API keys** regularly
- **Use least privilege** - create API keys with minimal permissions

### Network Security

- **Use HTTPS** for API communications
- **Verify SSL certificates** for custom endpoints
- **Monitor API usage** to detect unusual activity

### File Permissions

```bash
# Set appropriate permissions for configuration files
chmod 600 .env
chmod 644 config.json
chmod 644 input.json
```

## 🆘 Troubleshooting

### Common Installation Issues

#### Node.js Version Issues

```bash
# Error: Node.js version too old
# Solution: Update Node.js
nvm install 18
nvm use 18

# Or download from https://nodejs.org/
```

#### Permission Issues

```bash
# Error: EACCES permission denied
# Solution: Use npx or fix permissions
npx gepa-spo --help

# Or fix npm permissions
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config
```

#### Network Issues

```bash
# Error: Network timeout
# Solution: Check network and try again
npm config set registry https://registry.npmjs.org/
npm config set timeout 60000
```

#### API Key Issues

```bash
# Error: OpenAI API key required
# Solution: Set API key correctly
export OPENAI_API_KEY="your-actual-api-key"
echo $OPENAI_API_KEY  # Verify it's set
```

### Getting Help

If you encounter issues:

1. **Check the [FAQ](../reference/faq.md)** for common solutions
2. **Review [Troubleshooting Guide](../reference/troubleshooting.md)**
3. **Search existing [GitHub Issues](https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution/issues)**
4. **Create a new issue** with detailed error information

## 📦 Package Managers

### npm

```bash
# Install globally
npm install -g gepa-spo

# Install locally
npm install gepa-spo

# Run with npx
npx gepa-spo --help
```

### pnpm (Recommended)

```bash
# Install globally
pnpm add -g gepa-spo

# Install locally
pnpm add gepa-spo

# Run with npx
npx gepa-spo --help
```

### yarn

```bash
# Install globally
yarn global add gepa-spo

# Install locally
yarn add gepa-spo

# Run with npx
npx gepa-spo --help
```

## 🔄 Updates

### Updating GEPA

#### npx Method (Automatic)
```bash
# Always uses latest version
npx gepa-spo --help
```

#### Global Installation
```bash
# Update global installation
npm update -g gepa-spo
# or
pnpm update -g gepa-spo
```

#### Local Development
```bash
# Pull latest changes
git pull origin main

# Update dependencies
pnpm install

# Rebuild
pnpm build
```

## 📋 Next Steps

After successful installation:

1. **Read the [Quick Start Guide](quick-start.md)** to run your first optimization
2. **Explore [Basic Concepts](concepts.md)** to understand GEPA fundamentals
3. **Check out [Examples](../examples/README.md)** for working configurations
4. **Review [CLI Reference](../user-guides/cli-reference.md)** for all available options

---

**Ready to optimize? Check out the [Quick Start Guide](quick-start.md) to begin!**
