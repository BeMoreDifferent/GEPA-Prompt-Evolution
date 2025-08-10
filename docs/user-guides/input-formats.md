# Input Formats Guide

Complete guide to the input formats supported by GEPA (Genetic-Pareto) Prompt Evolution.

## 📋 Overview

GEPA accepts JSON input files that define your system prompt (or modular system) and a set of test prompts for optimization. The input format is flexible and supports both single-system and modular-system optimization.

## 🚀 Basic Input Structure

### Required Fields

Every input file must contain:

```json
{
  "prompts": [
    {
      "id": "unique-identifier",
      "user": "User input text"
    }
  ]
}
```

### Optional Fields

- `system`: Single system prompt (for single-system optimization)
- `modules`: Array of module objects (for modular-system optimization)
- `meta`: Additional metadata for prompts

## 📝 Single System Format

### Basic Single System

```json
{
  "system": "You are a helpful assistant. Be concise and accurate.",
  "prompts": [
    {
      "id": "math-1",
      "user": "What is 2 + 2?"
    },
    {
      "id": "fact-1",
      "user": "What is the capital of France?"
    },
    {
      "id": "code-1",
      "user": "Write a function to calculate fibonacci numbers."
    }
  ]
}
```

### Single System with Metadata

```json
{
  "system": "You are a technical support specialist. Provide clear, step-by-step solutions.",
  "prompts": [
    {
      "id": "support-1",
      "user": "My computer won't turn on. What should I do?",
      "meta": {
        "category": "hardware",
        "difficulty": "easy",
        "priority": "high"
      }
    },
    {
      "id": "support-2",
      "user": "How do I install Python on Windows?",
      "meta": {
        "category": "software",
        "difficulty": "medium",
        "priority": "medium"
      }
    }
  ]
}
```

## 🧩 Modular System Format

### Basic Modular System

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are friendly and helpful."
    },
    {
      "id": "safety",
      "prompt": "Never provide harmful content."
    },
    {
      "id": "instructions",
      "prompt": "Provide accurate, concise answers."
    }
  ],
  "prompts": [
    {
      "id": "math-1",
      "user": "What is 2 + 2?"
    },
    {
      "id": "fact-1",
      "user": "What is the capital of France?"
    }
  ]
}
```

### Advanced Modular System

```json
{
  "modules": [
    {
      "id": "role",
      "prompt": "You are a math tutor with 20 years of teaching experience."
    },
    {
      "id": "teaching_method",
      "prompt": "Use the Socratic method - ask guiding questions rather than giving direct answers."
    },
    {
      "id": "safety",
      "prompt": "Never provide complete homework solutions. Guide students to find answers themselves."
    },
    {
      "id": "formatting",
      "prompt": "Use clear mathematical notation and step-by-step explanations."
    }
  ],
  "prompts": [
    {
      "id": "algebra-1",
      "user": "How do I solve 2x + 5 = 13?",
      "meta": {
        "subject": "algebra",
        "difficulty": "beginner",
        "topic": "linear_equations"
      }
    },
    {
      "id": "geometry-1",
      "user": "What is the area of a circle with radius 5?",
      "meta": {
        "subject": "geometry",
        "difficulty": "intermediate",
        "topic": "area_calculation"
      }
    }
  ]
}
```

## 📊 Prompt Structure

### Prompt Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier for the prompt |
| `user` | string | ✅ | User input text |
| `meta` | object | ❌ | Additional metadata |

### ID Requirements

- **Unique**: Each prompt must have a unique ID
- **String**: Must be a string value
- **Descriptive**: Use meaningful IDs for easier tracking
- **Safe**: Avoid special characters that might cause issues

### User Input Guidelines

- **Clear**: Make inputs clear and unambiguous
- **Diverse**: Include a variety of question types
- **Realistic**: Use realistic, practical questions
- **Challenging**: Include some challenging cases to test robustness

### Metadata Usage

Metadata is optional but useful for:

```json
{
  "id": "example-1",
  "user": "Explain quantum computing in simple terms.",
  "meta": {
    "category": "science",
    "difficulty": "intermediate",
    "audience": "general",
    "expected_length": "medium",
    "requires_examples": true
  }
}
```

## 🎯 Input Design Best Practices

### 1. Diverse Test Cases

Include a variety of question types:

```json
{
  "prompts": [
    {
      "id": "factual-1",
      "user": "What is the population of Tokyo?"
    },
    {
      "id": "analytical-1",
      "user": "Compare the benefits of electric vs gas cars."
    },
    {
      "id": "creative-1",
      "user": "Write a short story about a robot learning to paint."
    },
    {
      "id": "technical-1",
      "user": "Explain how SSL certificates work."
    },
    {
      "id": "ethical-1",
      "user": "What are the ethical implications of AI in healthcare?"
    }
  ]
}
```

### 2. Edge Cases

Include challenging scenarios:

```json
{
  "prompts": [
    {
      "id": "ambiguous-1",
      "user": "What should I do?"
    },
    {
      "id": "complex-1",
      "user": "Explain the relationship between quantum mechanics, relativity, and consciousness."
    },
    {
      "id": "sensitive-1",
      "user": "How do I handle a difficult conversation with my boss?"
    },
    {
      "id": "technical-edge-1",
      "user": "Debug this code: function(x) { return x + 1; }"
    }
  ]
}
```

### 3. Domain-Specific Examples

For specialized use cases:

```json
{
  "prompts": [
    {
      "id": "medical-1",
      "user": "What are the symptoms of diabetes?",
      "meta": {
        "domain": "medical",
        "disclaimer": "Consult a healthcare professional for medical advice"
      }
    },
    {
      "id": "legal-1",
      "user": "What are the basic requirements for forming a contract?",
      "meta": {
        "domain": "legal",
        "disclaimer": "This is not legal advice"
      }
    },
    {
      "id": "financial-1",
      "user": "How do I calculate compound interest?",
      "meta": {
        "domain": "financial",
        "complexity": "intermediate"
      }
    }
  ]
}
```

## 🔧 Module Design Guidelines

### Module Structure

Each module must have:

```json
{
  "id": "unique-module-id",
  "prompt": "Module prompt text"
}
```

### Module ID Requirements

- **Unique**: Each module must have a unique ID
- **Descriptive**: Use meaningful names (e.g., "personality", "safety", "instructions")
- **Consistent**: Use consistent naming conventions
- **Short**: Keep IDs concise but clear

### Module Design Principles

#### 1. Single Responsibility

Each module should have one clear purpose:

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are enthusiastic and encouraging."
    },
    {
      "id": "safety",
      "prompt": "Never provide harmful, dangerous, or illegal content."
    },
    {
      "id": "formatting",
      "prompt": "Use bullet points and numbered lists for clarity."
    }
  ]
}
```

#### 2. Independence

Modules should work well independently:

```json
{
  "modules": [
    {
      "id": "context_analyzer",
      "prompt": "Analyze the user's context and determine the appropriate response type."
    },
    {
      "id": "response_generator",
      "prompt": "Generate responses based on the context analysis."
    }
  ]
}
```

#### 3. Consistency

Modules should have consistent interfaces:

```json
{
  "modules": [
    {
      "id": "input_processing",
      "prompt": "Always clarify ambiguous questions before answering."
    },
    {
      "id": "output_formatting",
      "prompt": "Structure responses with clear headings and sections."
    }
  ]
}
```

## 📁 Input File Examples

### Customer Support System

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are a friendly, professional customer support representative."
    },
    {
      "id": "empathy",
      "prompt": "Acknowledge customer concerns and show understanding of their situation."
    },
    {
      "id": "problem_solving",
      "prompt": "Use systematic troubleshooting to identify and resolve issues."
    },
    {
      "id": "escalation",
      "prompt": "Know when to escalate complex issues to human support."
    }
  ],
  "prompts": [
    {
      "id": "login-issue",
      "user": "I can't log into my account. It says 'invalid credentials'.",
      "meta": {
        "category": "authentication",
        "priority": "high"
      }
    },
    {
      "id": "payment-issue",
      "user": "My payment was charged twice. How do I get a refund?",
      "meta": {
        "category": "billing",
        "priority": "high"
      }
    },
    {
      "id": "feature-request",
      "user": "Can you add dark mode to the mobile app?",
      "meta": {
        "category": "feature_request",
        "priority": "low"
      }
    }
  ]
}
```

### Educational Tutor

```json
{
  "modules": [
    {
      "id": "role",
      "prompt": "You are a patient, knowledgeable tutor who adapts to the student's level."
    },
    {
      "id": "teaching_method",
      "prompt": "Use examples, analogies, and step-by-step explanations."
    },
    {
      "id": "assessment",
      "prompt": "Ask follow-up questions to check understanding."
    },
    {
      "id": "encouragement",
      "prompt": "Provide positive reinforcement and build confidence."
    }
  ],
  "prompts": [
    {
      "id": "math-basics",
      "user": "I don't understand fractions. Can you help?",
      "meta": {
        "subject": "mathematics",
        "level": "beginner",
        "topic": "fractions"
      }
    },
    {
      "id": "science-concept",
      "user": "What is photosynthesis and why is it important?",
      "meta": {
        "subject": "science",
        "level": "intermediate",
        "topic": "biology"
      }
    }
  ]
}
```

### Technical Documentation Assistant

```json
{
  "modules": [
    {
      "id": "expertise",
      "prompt": "You are an expert technical writer with deep knowledge of software development."
    },
    {
      "id": "clarity",
      "prompt": "Write clear, concise documentation that is easy to understand."
    },
    {
      "id": "structure",
      "prompt": "Organize information logically with proper headings and examples."
    },
    {
      "id": "audience",
      "prompt": "Adapt the technical level to the intended audience."
    }
  ],
  "prompts": [
    {
      "id": "api-docs",
      "user": "Write documentation for a REST API endpoint that creates a user.",
      "meta": {
        "type": "api_documentation",
        "audience": "developers",
        "complexity": "intermediate"
      }
    },
    {
      "id": "user-guide",
      "user": "Create a user guide for installing our software on Windows.",
      "meta": {
        "type": "user_guide",
        "audience": "end_users",
        "complexity": "beginner"
      }
    }
  ]
}
```

## 🆘 Common Issues and Solutions

### Invalid JSON Format

**Problem**: JSON syntax errors
```json
// ❌ Missing comma
{
  "system": "You are helpful"
  "prompts": []
}

// ✅ Correct format
{
  "system": "You are helpful",
  "prompts": []
}
```

### Missing Required Fields

**Problem**: Missing prompts array
```json
// ❌ Missing prompts
{
  "system": "You are helpful"
}

// ✅ Include prompts
{
  "system": "You are helpful",
  "prompts": [
    {
      "id": "test-1",
      "user": "Hello"
    }
  ]
}
```

### Duplicate IDs

**Problem**: Non-unique prompt IDs
```json
// ❌ Duplicate IDs
{
  "prompts": [
    {"id": "test", "user": "Hello"},
    {"id": "test", "user": "World"}
  ]
}

// ✅ Unique IDs
{
  "prompts": [
    {"id": "test-1", "user": "Hello"},
    {"id": "test-2", "user": "World"}
  ]
}
```

### Invalid Module Structure

**Problem**: Missing required module fields
```json
// ❌ Missing prompt field
{
  "modules": [
    {"id": "personality"}
  ]
}

// ✅ Complete module
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are friendly."
    }
  ]
}
```

## 📋 Input Validation

GEPA validates your input file and will report errors for:

- **Missing prompts array**
- **Empty prompts array**
- **Missing required fields** (id, user)
- **Duplicate IDs**
- **Invalid module structure**
- **JSON syntax errors**

### Validation Error Example

```bash
Error: Input validation failed:
  - Missing required field 'id' in prompt at index 0
  - Duplicate ID 'test' found in prompts
  - Module 'personality' missing required field 'prompt'
```

## 🔄 Input File Management

### File Organization

Organize your input files logically:

```
inputs/
├── basic/
│   ├── single-system.json
│   └── modular-system.json
├── domain-specific/
│   ├── customer-support.json
│   ├── educational.json
│   └── technical.json
└── testing/
    ├── edge-cases.json
    └── validation.json
```

### Version Control

- **Track changes** to input files
- **Use descriptive commit messages**
- **Tag important versions**
- **Document changes** in README files

### Backup and Recovery

- **Keep backups** of important input files
- **Use descriptive filenames**
- **Include metadata** about file purpose and version
- **Test inputs** before using in production

---

**Ready to create your input files? Check out the [Examples Directory](../examples/README.md) for working templates!**
