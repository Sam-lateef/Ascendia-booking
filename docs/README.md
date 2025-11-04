# Multi-Agent Realtime Voice Application - Documentation

Complete technical documentation for understanding, using, and extending this OpenAI Realtime API + Agents SDK application.

## 📚 Documentation Structure

### [01 - Overview](./01-OVERVIEW.md)
**Start here if you're new to this application**

- What this application does
- Technology stack overview
- Two main agentic patterns (Chat-Supervisor & Sequential Handoffs)
- Project structure
- Quick start guide

**Read this if:** You want a high-level understanding of what the app does and how to get started.

---

### [02 - Architecture](./02-ARCHITECTURE.md)
**Deep dive into system design**

- Three-layer architecture (Frontend → API → OpenAI)
- Complete data flow diagrams for all major operations:
  - Connection flow
  - Message flow (user speaks)
  - Tool call flow
  - Agent handoff flow
  - Chat-Supervisor pattern flow
  - Guardrail flow
- WebRTC connection details
- Audio formats and codec selection
- State management with React contexts

**Read this if:** You want to understand how the system works internally, or need to debug issues.

---

### [03 - Components](./03-COMPONENTS.md)
**Detailed component and file documentation**

- Core React components (`App.tsx`, `Transcript`, `Events`, etc.)
- Custom hooks (`useRealtimeSession`, `useHandleSessionHistory`)
- Context providers (`TranscriptContext`, `EventContext`)
- Agent configuration files
- API routes
- Utility libraries
- Complete file organization with line counts

**Read this if:** You need to understand what each file/component does, or you're modifying existing code.

---

### [04 - Extending](./04-EXTENDING.md)
**How to customize and add features**

- Adding new agent scenarios
- Creating custom tools (with examples)
- Implementing agent handoffs
- Creating custom guardrails
- Customizing the Chat-Supervisor pattern
- Adding custom UI components
- Testing different audio codecs
- Environment variable configuration

**Read this if:** You want to add your own agents, tools, or customize the application for your use case.

---

### [05 - Best Practices](./05-BEST-PRACTICES.md)
**Tips, troubleshooting, and optimization**

- Writing effective agent instructions
- State machine pattern best practices
- Tool design best practices
- Performance optimization strategies
- Latency reduction techniques
- Common issues & solutions
- Cost optimization
- Security best practices
- Testing strategies
- Production deployment checklist

**Read this if:** You're building a production application or encountering issues.

---

### [06 - Q&A Guide](./06-QA-GUIDE.md)
**Common questions and detailed answers**

- Understanding specialized agents and tools
- Working with OpenAI vectors and files
- Calling external APIs and databases
- Smart orchestration and function selection
- Complex SQL query generation
- Real-world implementation examples

**Read this if:** You have specific questions about implementing features or want to see detailed explanations with code examples.

---

## 🚀 Quick Navigation

### I want to...

**Understand what this application does**
→ Start with [01 - Overview](./01-OVERVIEW.md)

**Learn how the system works internally**
→ Read [02 - Architecture](./02-ARCHITECTURE.md)

**Find where a specific feature is implemented**
→ Check [03 - Components](./03-COMPONENTS.md)

**Add my own agents or tools**
→ Follow [04 - Extending](./04-EXTENDING.md)

**Fix an issue or optimize performance**
→ Consult [05 - Best Practices](./05-BEST-PRACTICES.md)

**Build a customer service voice agent**
→ Study the `customerServiceRetail` example in [03 - Components](./03-COMPONENTS.md#agentconfigscustomerserviceretail)

**Migrate my existing chatbot to voice**
→ Use the Chat-Supervisor pattern documented in [01 - Overview](./01-OVERVIEW.md#pattern-1-chat-supervisor)

**Debug WebRTC connection issues**
→ See [05 - Best Practices](./05-BEST-PRACTICES.md#issue-webrtc-connection-fails)

**Understand how to work with databases and external APIs**
→ Read [06 - Q&A Guide](./06-QA-GUIDE.md#calling-external-apis--databases)

**Learn about SQL query generation with AI**
→ Read [06 - Q&A Guide](./06-QA-GUIDE.md#complex-sql-query-generation)

---

## 📖 Suggested Reading Order

### For Beginners
1. [01 - Overview](./01-OVERVIEW.md) - Understand the basics
2. [03 - Components](./03-COMPONENTS.md) - Learn the structure
3. [04 - Extending](./04-EXTENDING.md) - Try customizing

### For Developers
1. [01 - Overview](./01-OVERVIEW.md) - High-level context
2. [02 - Architecture](./02-ARCHITECTURE.md) - System design
3. [03 - Components](./03-COMPONENTS.md) - Implementation details
4. [04 - Extending](./04-EXTENDING.md) - Customization guide
5. [05 - Best Practices](./05-BEST-PRACTICES.md) - Production readiness

### For Architects
1. [01 - Overview](./01-OVERVIEW.md) - System capabilities
2. [02 - Architecture](./02-ARCHITECTURE.md) - Technical architecture
3. [05 - Best Practices](./05-BEST-PRACTICES.md) - Optimization & security

---

## 🎯 Key Concepts

### Two Agentic Patterns

**Chat-Supervisor Pattern**
- Lightweight realtime agent handles simple tasks
- Intelligent supervisor (GPT-4.1) handles complex tasks
- Best for: Migrating existing chatbots to voice

**Sequential Handoffs Pattern**
- Specialized agents for different domains
- Seamless transfers between agents
- Best for: Customer service with multiple departments

### Architecture Layers

1. **Frontend (Next.js)** - React UI, WebRTC connection
2. **API Routes** - Ephemeral keys, supervisor proxy
3. **OpenAI Services** - Realtime API, Responses API

### Core Technologies

- **OpenAI Realtime API** - Voice interaction
- **OpenAI Agents SDK** - Agent orchestration
- **WebRTC** - Real-time audio streaming
- **Next.js** - Full-stack framework
- **TypeScript** - Type safety

---

## 📊 Documentation Stats

| Document | Lines | Topics | Best For |
|----------|-------|--------|----------|
| 01-OVERVIEW.md | ~160 | Intro, stack, patterns | Getting started |
| 02-ARCHITECTURE.md | ~240 | Data flows, WebRTC | Understanding internals |
| 03-COMPONENTS.md | ~380 | Files, components | Finding code |
| 04-EXTENDING.md | ~480 | Customization | Building features |
| 05-BEST-PRACTICES.md | ~440 | Tips, troubleshooting | Production deployment |
| 06-QA-GUIDE.md | ~840 | Q&A, examples | Implementation help |
| **Total** | **~2,540** | **60+** | **Complete reference** |

---

## 🔗 External Resources

- [Official OpenAI Realtime Agents GitHub](https://github.com/openai/openai-realtime-agents)
- [OpenAI Agents SDK Documentation](https://github.com/openai/openai-agents-js)
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [WebRTC Fundamentals](https://webrtc.org/getting-started/overview)

---

## 💡 Contributing to Documentation

Found something unclear? Want to add examples? Here's how to help:

1. Identify which document needs updates
2. Make your changes (keep the style consistent)
3. Test code examples to ensure they work
4. Submit for review

**Style Guidelines:**
- Use clear, concise language
- Include code examples with comments
- Mark bad examples with ❌ and good with ✅
- Cross-reference other documents
- Keep line length under 100 characters

---

## 📝 Document Version

- **Created:** October 2025
- **Application Version:** Based on OpenAI Realtime Agents Demo
- **SDK Version:** @openai/agents ^0.0.5
- **Last Updated:** Check git history

---

## ❓ Still Have Questions?

- Check the [troubleshooting section](./05-BEST-PRACTICES.md#common-issues--solutions)
- Review the [official OpenAI examples](https://github.com/openai/openai-realtime-agents)
- Search through the codebase for specific implementations
- Open an issue on the official repo

---

**Happy Building! 🎙️🤖**

