# 🌍 AI-Powered Translation System

## ✅ Simple Approach - No URL Changes!

Unlike traditional i18n systems that add `/en/`, `/ar/` prefixes to URLs, this implementation uses:
- **localStorage** to persist language preference
- **URL parameter** `?lang=ar` for initial language selection
- **React Context** for global state management

### Why This Approach?
- ✅ **No Breaking Changes**: All URLs stay the same (`/admin/booking`, `/api/twilio/incoming-call`)
- ✅ **Webhooks Work**: Twilio webhooks don't break
- ✅ **Simple Deployment**: No routing changes needed
- ✅ **User-Friendly**: Language persists across sessions

---

## 🚀 How It Works

### 1. Language Selection
**Three ways to set language:**

1. **URL Parameter** (one-time):
   ```
   http://localhost:3000/admin/booking?lang=ar
   ```

2. **Language Switcher** (in admin header):
   - Click globe icon 🌍
   - Select language
   - Automatically saved to localStorage

3. **Per-Organization** (future):
   - Store in database per org/instance
   - Load on login

### 2. Translation Storage
All translations stored in `/messages/` folder:
```
messages/
  ├── en.json        # English (base)
  ├── ar.json        # Arabic
  ├── tr.json        # Turkish
  └── context.json   # Business context for AI
```

### 3. AI Translation
**Translation Manager** at `/admin/booking/translations`:
- Edit business context
- Select target language
- Click "Auto-Translate All" (uses GPT-4o-mini)
- Review and edit translations
- Save to JSON file

---

## 📝 Usage Examples

### For Developers

**In any component:**
```tsx
import { useTranslations } from '@/lib/i18n/TranslationProvider';

export default function MyComponent() {
  const t = useTranslations('dashboard'); // section
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
  );
}
```

**Get current locale:**
```tsx
import { useLocale } from '@/lib/i18n/TranslationProvider';

const locale = useLocale(); // 'en', 'ar', etc.
```

### For End Users

**Step 1: Access Translation Manager**
1. Login to admin dashboard
2. Click "Translations" in sidebar
3. You'll see the Translation Manager

**Step 2: Configure Business Context** (optional but recommended)
```json
{
  "businessType": "Hair Salon",
  "description": "Modern hair salon booking system",
  "tone": "casual and friendly",
  "customMappings": {
    "provider": "stylist",
    "operatory": "station",
    "patient": "customer"
  }
}
```

**Step 3: Translate**
1. Select target language (e.g., Arabic)
2. Click "Auto-Translate All"
3. Wait for AI translation (30-60 seconds)
4. Review translations
5. Edit any translation inline
6. Click "Save Translations"

**Step 4: Switch Language**
1. Click globe icon 🌍 in header
2. Select your language
3. All labels update instantly!

---

## 🎨 Customization per Business Type

### Dental Clinic (Default)
```json
{
  "businessType": "Dental Clinic",
  "customMappings": {
    "provider": "doctor/dentist",
    "operatory": "treatment room",
    "patient": "patient"
  }
}
```

### Hair Salon
```json
{
  "businessType": "Hair Salon",
  "customMappings": {
    "provider": "stylist",
    "operatory": "station",
    "patient": "customer"
  }
}
```

### Spa
```json
{
  "businessType": "Spa",
  "customMappings": {
    "provider": "therapist",
    "operatory": "treatment room",
    "patient": "client"
  }
}
```

---

## 🌐 Supported Languages (45+)

Arabic, Turkish, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Hindi, Bengali, Punjabi, Urdu, Vietnamese, Thai, Indonesian, Malay, Filipino, Dutch, Polish, Ukrainian, Czech, Romanian, Greek, Hebrew, Swedish, Norwegian, Danish, Finnish, Hungarian, Slovak, Bulgarian, Croatian, Serbian, Slovenian, Lithuanian, Latvian, Estonian, Persian, Swahili, Amharic

---

## 🔧 Technical Details

### Architecture
```
┌─────────────────────────────────────┐
│  TranslationProvider (React Context)│
│  - Manages current locale           │
│  - Loads translations from JSON     │
│  - Persists to localStorage         │
└─────────────────────────────────────┘
                  │
                  ├─ useTranslations(section)
                  ├─ useLocale()
                  └─ useTranslation(section)
                  
┌─────────────────────────────────────┐
│  Translation Manager UI              │
│  - Context editor                    │
│  - Language selector                 │
│  - Auto-translate button (AI)        │
│  - Inline editing                    │
│  - Save to JSON                      │
└─────────────────────────────────────┘
                  │
                  ├─ POST /api/admin/translations/ai-translate
                  │  (GPT-4o-mini)
                  │
                  └─ POST /api/admin/translations/save
                     (Write JSON files)
```

### API Endpoints

**1. AI Translation**
```
POST /api/admin/translations/ai-translate
Body: {
  targetLanguage: 'ar',
  context: { businessType, description, ... },
  sourceMessages: { ... }
}
Response: {
  success: true,
  translatedMessages: { ... }
}
```

**2. Save Translations**
```
POST /api/admin/translations/save
Body: {
  locale: 'ar',
  messages: { ... },
  context: { ... }
}
Response: {
  success: true
}
```

---

## 📂 Key Files

### Core System
- `src/lib/i18n/TranslationProvider.tsx` - Translation context & hooks
- `src/lib/languages.ts` - Language list (45+ languages)
- `messages/en.json` - English translations (base)
- `messages/context.json` - Business context

### UI
- `src/app/admin/booking/translations/page.tsx` - Translation Manager UI
- `src/app/admin/booking/layout.tsx` - Language switcher

### API
- `src/app/api/admin/translations/ai-translate/route.ts` - AI translation
- `src/app/api/admin/translations/save/route.ts` - Save translations

---

## 🎯 Benefits

1. **No URL Changes**: All existing links, webhooks, APIs work
2. **User-Friendly**: Language persists across sessions
3. **AI-Powered**: Context-aware translations in seconds
4. **Unlimited Languages**: Support any language
5. **Editable**: Both UI and direct JSON editing
6. **Cost-Effective**: Uses gpt-4o-mini for translations
7. **Flexible**: Per-user or per-organization language settings

---

## 🚀 Next Steps

1. **Test locally**: Visit http://localhost:3000/admin/booking
2. **Translate to your language**: Use Translation Manager
3. **Customize context**: Edit business context for better translations
4. **Deploy**: No special deployment steps needed!

---

## 💡 Pro Tips

1. **Better Translations**: Add detailed business context
2. **Consistent Terms**: Use customMappings for domain-specific words
3. **Review AI Output**: Always review and edit AI translations
4. **Version Control**: Commit translation files to git
5. **Backup**: Translation saves create .backup files automatically

---

## 🐛 Troubleshooting

**Language not changing?**
- Clear localStorage: `localStorage.clear()`
- Check browser console for errors
- Verify JSON file exists in `/messages/`

**Translations not working?**
- Check `/public/messages/` folder has files
- Verify JSON syntax is valid
- Check browser network tab for 404s

**AI translation failing?**
- Verify OPENAI_API_KEY is set
- Check API quota/limits
- Try smaller sections if too large





