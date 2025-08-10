# Troubleshooting Guide

Common issues and solutions for GEPA (Genetic-Pareto) Prompt Evolution.

## 🚨 Quick Fixes

### Most Common Issues

| Issue | Quick Fix |
|-------|-----------|
| **API Key Error** | `export OPENAI_API_KEY="your-key"` |
| **Budget Too Small** | Increase `budget` to 50+ in config.json |
| **Data Split Impossible** | Reduce `paretoSize` or `holdoutSize` |
| **Lock File Exists** | Wait for other process or remove `.lock` file |
| **No Improvement** | Increase `budget` or adjust `rubric` |

## 🔑 API and Authentication Issues

### OpenAI API Key Problems

#### Error: "OpenAI API key required"

**Symptoms**:
```bash
Error: OpenAI API key required. Set --api-key or OPENAI_API_KEY environment variable.
```

**Solutions**:

1. **Set Environment Variable**:
```bash
# Linux/macOS
export OPENAI_API_KEY="sk-your-actual-api-key"

# Windows (Command Prompt)
set OPENAI_API_KEY=sk-your-actual-api-key

# Windows (PowerShell)
$env:OPENAI_API_KEY="sk-your-actual-api-key"
```

2. **Use CLI Flag**:
```bash
npx gepa-spo --api-key "sk-your-actual-api-key" --input input.json --config config.json
```

3. **Create .env File**:
```bash
# .env
OPENAI_API_KEY=sk-your-actual-api-key
```

#### Error: "Invalid API key"

**Symptoms**:
```bash
Error: Invalid API key
```

**Solutions**:
- Verify your API key is correct
- Check if the key has expired
- Ensure the key has sufficient credits
- Try regenerating the API key

#### Error: "Rate limit exceeded"

**Symptoms**:
```bash
Error: Rate limit exceeded
```

**Solutions**:
- Wait a few minutes and retry
- Reduce `minibatchSize` to decrease request frequency
- Use a different API key
- Upgrade your OpenAI plan

### Custom API Endpoint Issues

#### Error: "Connection refused"

**Symptoms**:
```bash
Error: Connection refused
```

**Solutions**:
```json
{
  "baseURL": "https://your-correct-endpoint.com/v1",
  "requestTimeoutMs": 30000
}
```

## ⚙️ Configuration Issues

### Budget Configuration

#### Error: "Budget too small"

**Symptoms**:
```bash
Error: Budget must be at least 10 (got: 5). Recommended: 50-200 for meaningful optimization.
```

**Solutions**:
```json
{
  "budget": 100  // Increase to at least 50
}
```

**Budget Guidelines**:
- **Quick test**: 20-50
- **Moderate optimization**: 50-100
- **Thorough optimization**: 100-200
- **Exhaustive optimization**: 200+

### Data Split Issues

#### Error: "Data split impossible"

**Symptoms**:
```bash
Error: Data split impossible: paretoSize=8 + holdoutSize=4 >= total prompts=10
```

**Solutions**:

1. **Add More Prompts**:
```json
// Add more prompts to your input file
{
  "prompts": [
    // ... existing prompts ...
    { "id": "new-1", "user": "Additional test case" },
    { "id": "new-2", "user": "Another test case" }
  ]
}
```

2. **Reduce Split Sizes**:
```json
{
  "paretoSize": 4,  // Reduce from 8
  "holdoutSize": 2, // Reduce from 4
  "minibatchSize": 4
}
```

3. **Use No Holdout**:
```json
{
  "paretoSize": 6,
  "holdoutSize": 0, // No holdout validation
  "minibatchSize": 4
}
```

#### Error: "Minibatch size too large"

**Symptoms**:
```bash
Error: Minibatch size (6) too large for available feedback prompts (2)
```

**Solutions**:
```json
{
  "paretoSize": 6,
  "holdoutSize": 2,
  "minibatchSize": 2  // Reduce from 6
}
```

### Model Configuration

#### Error: "Model not found"

**Symptoms**:
```bash
Error: Model gpt-5-mini not found
```

**Solutions**:
```json
{
  "actorModel": "gpt-4",  // Use available model
  "judgeModel": "gpt-4"
}
```

**Available Models**:
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- `gpt-5-mini` (if available)

## 📁 File and Path Issues

### Input File Problems

#### Error: "Input file not found"

**Symptoms**:
```bash
Error: ENOENT: no such file or directory, open 'input.json'
```

**Solutions**:
```bash
# Check if file exists
ls -la input.json

# Use absolute path
npx gepa-spo --input /full/path/to/input.json --config config.json

# Check current directory
pwd
```

#### Error: "Invalid JSON format"

**Symptoms**:
```bash
Error: Unexpected token in JSON at position 123
```

**Solutions**:
1. **Validate JSON**:
```bash
# Use online JSON validator
# Or use jq
jq . input.json
```

2. **Common JSON Issues**:
```json
// ❌ Missing comma
{
  "system": "You are helpful"
  "prompts": []
}

// ✅ Correct
{
  "system": "You are helpful",
  "prompts": []
}
```

### Configuration File Issues

#### Error: "Config file not found"

**Symptoms**:
```bash
Error: ENOENT: no such file or directory, open 'config.json'
```

**Solutions**:
```bash
# Create basic config
cat > config.json << EOF
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "rubric": "Correctness, clarity, and conciseness."
}
EOF
```

## 🔒 Lock and Process Issues

### Lock File Problems

#### Error: "Lock exists"

**Symptoms**:
```bash
Error: Lock exists at ./runs/run-dir. Another process running?
```

**Solutions**:

1. **Wait for Process**:
```bash
# Check if process is running
ps aux | grep gepa

# Wait for it to finish
```

2. **Remove Lock File** (if safe):
```bash
# Only if you're sure no other process is running
rm ./runs/run-dir/.lock
```

3. **Use Different Run Directory**:
```bash
npx gepa-spo --runs-root ./different-runs --input input.json --config config.json
```

### Process Interruption

#### Error: "Process killed"

**Symptoms**:
```bash
# Process terminated unexpectedly
```

**Solutions**:
```bash
# Resume from where you left off
npx gepa-spo --resume ./runs/previous-run-directory
```

## 📊 Performance Issues

### No Improvement

#### Problem: No score improvement

**Symptoms**:
- Scores remain the same or decrease
- Low acceptance rate
- No meaningful optimization

**Solutions**:

1. **Increase Budget**:
```json
{
  "budget": 200  // Increase from current value
}
```

2. **Adjust Rubric**:
```json
{
  "rubric": "Correctness, clarity, safety, and helpfulness."  // More specific
}
```

3. **Check Data Quality**:
```json
{
  "prompts": [
    // Ensure diverse, challenging prompts
    { "id": "easy", "user": "What is 2+2?" },
    { "id": "medium", "user": "Explain quantum computing." },
    { "id": "hard", "user": "Design a distributed system." }
  ]
}
```

4. **Try Different Models**:
```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4"
}
```

### Overfitting

#### Problem: High training, low validation performance

**Symptoms**:
- High scores on training data
- Poor performance on holdout data
- Large gap between training and validation

**Solutions**:

1. **Increase Holdout Size**:
```json
{
  "holdoutSize": 4,  // Increase from current value
  "epsilonHoldout": 0.01  // Stricter threshold
}
```

2. **Add More Diverse Data**:
```json
{
  "prompts": [
    // Add more diverse test cases
    { "id": "edge-1", "user": "Ambiguous question" },
    { "id": "edge-2", "user": "Complex multi-part question" }
  ]
}
```

3. **Reduce Complexity**:
```json
{
  "crossoverProb": 0.1,  // Reduce from higher value
  "minibatchSize": 3     // Smaller batches
}
```

### Slow Performance

#### Problem: Optimization is too slow

**Symptoms**:
- Long iteration times
- High API latency
- Slow overall progress

**Solutions**:

1. **Use Faster Models**:
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini"
}
```

2. **Reduce Batch Size**:
```json
{
  "minibatchSize": 2  // Smaller batches
}
```

3. **Optimize Network**:
```json
{
  "requestTimeoutMs": 30000  // Shorter timeout
}
```

## 🧩 Modular System Issues

### Module Conflicts

#### Problem: Modules contradict each other

**Symptoms**:
- Inconsistent behavior
- Conflicting instructions
- Poor overall performance

**Solutions**:

1. **Review Module Responsibilities**:
```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are friendly and helpful."  // Clear, single purpose
    },
    {
      "id": "safety",
      "prompt": "Never provide harmful content."  // Separate concern
    }
  ]
}
```

2. **Test Modules Independently**:
```typescript
// Test each module separately
const personalityModule = { id: "personality", prompt: "You are friendly." };
const result = await testModule(personalityModule, testCases);
```

### Crossover Issues

#### Problem: Crossover not improving performance

**Symptoms**:
- Low crossover acceptance rate
- No benefit from crossover operations
- Poor module combinations

**Solutions**:

1. **Adjust Crossover Probability**:
```json
{
  "crossoverProb": 0.3  // Try different values: 0.1, 0.2, 0.4
}
```

2. **Check Module Independence**:
```json
{
  "modules": [
    // Ensure modules are independent
    { "id": "role", "prompt": "You are a tutor." },
    { "id": "style", "prompt": "Use clear explanations." }
  ]
}
```

3. **Increase Budget for Crossover**:
```json
{
  "budget": 200,  // More budget for crossover exploration
  "crossoverProb": 0.4
}
```

## 🔧 Network and Connectivity

### Connection Issues

#### Error: "Network timeout"

**Symptoms**:
```bash
Error: Network timeout
```

**Solutions**:

1. **Increase Timeout**:
```json
{
  "requestTimeoutMs": 60000  // 60 seconds
}
```

2. **Check Network**:
```bash
# Test connectivity
curl -I https://api.openai.com/v1/models

# Check DNS
nslookup api.openai.com
```

3. **Use Different Network**:
```bash
# Try different network connection
# Or use VPN if needed
```

### Rate Limiting

#### Error: "Too many requests"

**Symptoms**:
```bash
Error: Rate limit exceeded
```

**Solutions**:

1. **Reduce Request Frequency**:
```json
{
  "minibatchSize": 2,  // Smaller batches
  "paretoSize": 4      // Fewer Pareto evaluations
}
```

2. **Add Delays**:
```typescript
// In custom implementation
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
await delay(1000); // 1 second delay
```

3. **Use Multiple API Keys**:
```bash
# Rotate between multiple API keys
export OPENAI_API_KEY="key-1"
# ... run optimization ...
export OPENAI_API_KEY="key-2"
```

## 📝 Debugging Techniques

### Enable Debug Logging

```bash
npx gepa-spo --input input.json --config config.json --log --log-level debug
```

### Check Run Directory

```bash
# Examine run files
ls -la ./runs/latest-run/

# Check statistics
cat ./runs/latest-run/statistics.json

# Check state
cat ./runs/latest-run/state.json
```

### Validate Configuration

```bash
# Test configuration without running
npx gepa-spo --input input.json --config config.json --help
```

### Test Individual Components

```typescript
// Test execution function
const testExecute = async () => {
  const result = await execute({ 
    candidate: { system: "You are helpful." }, 
    item: { id: "test", user: "Hello" } 
  });
  console.log(result);
};

// Test evaluation function
const testMuf = async () => {
  const result = await muf({ 
    item: { id: "test", user: "Hello" }, 
    output: "Hi there!", 
    traces: null 
  });
  console.log(result);
};
```

## 🆘 Getting Help

### Before Asking for Help

1. **Check this guide** for your specific error
2. **Search existing issues** on GitHub
3. **Enable debug logging** and include output
4. **Provide minimal reproduction** case

### When Creating an Issue

Include:
- **Error message** (exact text)
- **Configuration files** (input.json, config.json)
- **Debug output** (with --log --log-level debug)
- **Environment details** (OS, Node.js version)
- **Steps to reproduce**

### Example Issue Report

```
**Error**: Budget too small: 5. Need at least 10 for meaningful optimization.

**Configuration**:
```json
{
  "budget": 5,
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini"
}
```

**Steps to reproduce**:
1. Create config.json with budget: 5
2. Run: npx gepa-spo --input input.json --config config.json
3. See error

**Expected**: Should work with budget 5
**Actual**: Error about minimum budget

**Environment**: macOS 12.0, Node.js 18.0.0
```

## 📋 Prevention Checklist

### Before Running Optimization

- [ ] **API key set correctly**
- [ ] **Budget >= 50** for meaningful optimization
- [ ] **Data split valid** (paretoSize + holdoutSize < total prompts)
- [ ] **Input file valid JSON** with required fields
- [ ] **Config file valid JSON** with required fields
- [ ] **No other GEPA processes running**
- [ ] **Sufficient API credits**
- [ ] **Network connectivity stable**

### During Optimization

- [ ] **Monitor acceptance rate** (30-70% target)
- [ ] **Check improvement trends** (should be positive)
- [ ] **Watch for overfitting** (training vs validation gap)
- [ ] **Monitor API usage** (rate limits, costs)
- [ ] **Backup important runs** regularly

### After Optimization

- [ ] **Review final statistics**
- [ ] **Test optimized prompt** on new examples
- [ ] **Save best configuration** for future use
- [ ] **Document lessons learned**
- [ ] **Clean up old run directories** if needed

---

**Still having issues? Check the [FAQ](faq.md) or [open an issue](https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution/issues) on GitHub!**
