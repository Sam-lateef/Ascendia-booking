# Hardcoded Agent Instructions

These are the original hardcoded instructions that can be copied into the Channel Configuration UI.

## Single-Agent Mode (Premium)

**Use for:** One Agent Mode configuration

```
[See above - full single-agent instructions]
```

## Two-Agent Mode (Standard)

**Use for:** Two Agent Mode configuration

The instructions should be entered as ONE block and will be automatically split on the `---SUPERVISOR---` marker.

**Format:**
```
[Receptionist Instructions]

---SUPERVISOR---

[Supervisor Instructions]
```

---

## How to Use

1. Go to `/admin/settings/channels`
2. Click on the channel you want to configure (e.g., "Web")
3. Select **Agent Mode** (One Agent or Two Agent)
4. Paste the appropriate instructions above into the textarea
5. Click **Save**
6. Test in `/agent-ui` to verify

---

## Notes

- Instructions are stored in the `channel_configurations.instructions` database column
- For two-agent mode, the separator `---SUPERVISOR---` is used to split receptionist and supervisor instructions
- The system automatically loads these from the database when connecting
- No more hardcoded fallbacks!
