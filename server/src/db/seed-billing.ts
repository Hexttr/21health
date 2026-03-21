/**
 * Seed billing tables: AI providers, models, and platform settings.
 * Run: cd server && npx tsx src/db/seed-billing.ts
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { aiProviders, aiModels, platformSettings } from './schema.js';

async function seedBilling() {
  const existingProviders = await db.select().from(aiProviders);
  const providersByName = new Map(existingProviders.map((provider) => [provider.name, provider]));

  async function ensureProvider(name: string, displayName: string, apiKeyEnv: string | null) {
    const existing = providersByName.get(name);
    if (!existing) {
      const [row] = await db.insert(aiProviders).values({
        name,
        displayName,
        apiKeyEnv,
        isActive: true,
      }).returning();
      providersByName.set(name, row);
      console.log(`Created provider: ${displayName}`);
      return row;
    }

    const [updated] = await db.update(aiProviders).set({
      displayName,
      apiKeyEnv,
      isActive: true,
    }).where(eq(aiProviders.id, existing.id)).returning();
    providersByName.set(name, updated);
    console.log(`Provider already exists: ${displayName}`);
    return updated;
  }

  const geminiProvider = await ensureProvider('gemini', 'Google Gemini', 'GEMINI_API_KEY');
  const groqProvider = await ensureProvider('groq', 'Groq', 'GROQ_API_KEY');
  const openaiProvider = await ensureProvider('openai', 'OpenAI', 'OPENAI_API_KEY');
  const anthropicProvider = await ensureProvider('anthropic', 'Anthropic', 'ANTHROPIC_API_KEY');
  const providerIds = {
    gemini: geminiProvider.id,
    groq: groqProvider.id,
    openai: openaiProvider.id,
    anthropic: anthropicProvider.id,
  } as const;

  // Seed models (base costs in RUB, approximate provider себестоимость without platform markup)
  const existingModels = await db.select().from(aiModels);
  const modelSeeds = [
    // Text models
    {
      modelKey: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.015',
      outputPricePer1k: '0.060',
      fixedPrice: '0',
      sortOrder: 1,
      isActive: true,
      providerName: 'gemini',
    },
    {
      modelKey: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.125',
      outputPricePer1k: '1.000',
      fixedPrice: '0',
      sortOrder: 2,
      isActive: true,
      providerName: 'gemini',
    },
    {
      modelKey: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash Lite',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.010',
      outputPricePer1k: '0.040',
      fixedPrice: '0',
      sortOrder: 3,
      isActive: true,
      providerName: 'gemini',
    },
    {
      modelKey: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.010',
      outputPricePer1k: '0.040',
      fixedPrice: '0',
      sortOrder: 4,
      isActive: true,
      providerName: 'gemini',
    },
    {
      modelKey: 'gemini-1.5-flash',
      displayName: 'Gemini 1.5 Flash',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.010',
      outputPricePer1k: '0.040',
      fixedPrice: '0',
      sortOrder: 99,
      isActive: false,
      providerName: 'gemini',
    },
    {
      modelKey: 'llama-3.1-8b-instant',
      displayName: 'Groq Llama 3.1 8B Instant',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: false,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.005',
      outputPricePer1k: '0.010',
      fixedPrice: '0',
      sortOrder: 20,
      isActive: true,
      providerName: 'groq',
    },
    {
      modelKey: 'llama-3.3-70b-versatile',
      displayName: 'Groq Llama 3.3 70B',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: false,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.060',
      outputPricePer1k: '0.080',
      fixedPrice: '0',
      sortOrder: 21,
      isActive: true,
      providerName: 'groq',
    },
    {
      modelKey: 'openai/gpt-oss-20b',
      displayName: 'Groq GPT OSS 20B',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: false,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.010',
      outputPricePer1k: '0.020',
      fixedPrice: '0',
      sortOrder: 22,
      isActive: true,
      providerName: 'groq',
    },
    {
      modelKey: 'openai/gpt-oss-120b',
      displayName: 'Groq GPT OSS 120B',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: false,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.015',
      outputPricePer1k: '0.060',
      fixedPrice: '0',
      sortOrder: 23,
      isActive: true,
      providerName: 'groq',
    },
    {
      modelKey: 'qwen/qwen3-32b',
      displayName: 'Groq Qwen3 32B',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: false,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.020',
      outputPricePer1k: '0.040',
      fixedPrice: '0',
      sortOrder: 24,
      isActive: true,
      providerName: 'groq',
    },
    {
      modelKey: 'gpt-5-mini',
      displayName: 'GPT-5 Mini',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.025',
      outputPricePer1k: '0.200',
      fixedPrice: '0',
      sortOrder: 30,
      isActive: true,
      providerName: 'openai',
    },
    {
      modelKey: 'gpt-5.4',
      displayName: 'GPT-5.4',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.250',
      outputPricePer1k: '1.500',
      fixedPrice: '0',
      sortOrder: 31,
      isActive: true,
      providerName: 'openai',
    },
    {
      modelKey: 'gpt-5.2-thinking',
      displayName: 'GPT-5.2 Thinking',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.175',
      outputPricePer1k: '1.400',
      fixedPrice: '0',
      sortOrder: 32,
      isActive: false,
      providerName: 'openai',
    },
    {
      modelKey: 'gpt-4.1-mini',
      displayName: 'GPT-4.1 Mini',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.040',
      outputPricePer1k: '0.160',
      fixedPrice: '0',
      sortOrder: 33,
      isActive: true,
      providerName: 'openai',
    },
    {
      modelKey: 'claude-sonnet-4-6',
      displayName: 'Claude Sonnet 4.6',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.300',
      outputPricePer1k: '1.500',
      fixedPrice: '0',
      sortOrder: 40,
      isActive: true,
      providerName: 'anthropic',
    },
    {
      modelKey: 'claude-haiku-4-5-20251001',
      displayName: 'Claude Haiku 4.5',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsDocumentInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.100',
      outputPricePer1k: '0.500',
      fixedPrice: '0',
      sortOrder: 41,
      isActive: true,
      providerName: 'anthropic',
    },
    {
      modelKey: 'claude-opus-4-6',
      displayName: 'Claude Opus 4.6',
      modelType: 'text' as const,
      supportsStreaming: true,
      supportsImageInput: true,
      supportsImageOutput: false,
      supportsSystemPrompt: true,
      inputPricePer1k: '0.500',
      outputPricePer1k: '2.500',
      fixedPrice: '0',
      sortOrder: 42,
      isActive: true,
      providerName: 'anthropic',
    },
    // Image models (Gemini Image first = default, NanoBanana stays available)
    {
      modelKey: 'gemini-2.5-flash-image',
      displayName: 'Gemini 2.5 Flash Image',
      modelType: 'image' as const,
      supportsStreaming: false,
      supportsImageInput: true,
      supportsDocumentInput: false,
      supportsImageOutput: true,
      supportsSystemPrompt: false,
      inputPricePer1k: '0',
      outputPricePer1k: '0',
      fixedPrice: '4.00',
      sortOrder: 10,
      isActive: true,
      providerName: 'gemini',
    },
    {
      modelKey: 'gemini-3-pro-image-preview',
      displayName: 'NanoBanana Pro',
      modelType: 'image' as const,
      supportsStreaming: false,
      supportsImageInput: true,
      supportsDocumentInput: false,
      supportsImageOutput: true,
      supportsSystemPrompt: false,
      inputPricePer1k: '0',
      outputPricePer1k: '0',
      fixedPrice: '12.00',
      sortOrder: 11,
      isActive: true,
      providerName: 'gemini',
    },
  ];

  // Fix NanoBanana Pro modelKey (was nano-banana-pro-preview, correct is gemini-3-pro-image-preview)
  const oldNanoBanana = existingModels.find(m => m.modelKey === 'nano-banana-pro-preview');
  if (oldNanoBanana) {
    await db.update(aiModels).set({ modelKey: 'gemini-3-pro-image-preview', updatedAt: new Date() }).where(eq(aiModels.id, oldNanoBanana.id));
    console.log('Updated NanoBanana Pro modelKey to gemini-3-pro-image-preview');
  }

  // Make Gemini 2.5 Flash Image default (sortOrder 10), NanoBanana secondary (11)
  const allImageModels = await db.select().from(aiModels).where(eq(aiModels.modelType, 'image'));
  const nanoPro = allImageModels.find(m => m.modelKey === 'gemini-3-pro-image-preview');
  const geminiImg = allImageModels.find(m => m.modelKey === 'gemini-2.5-flash-image');
  if (geminiImg && geminiImg.sortOrder !== 10) {
    await db.update(aiModels).set({ sortOrder: 10, updatedAt: new Date() }).where(eq(aiModels.id, geminiImg.id));
    console.log('Set Gemini 2.5 Flash Image as default (sortOrder 10)');
  }
  if (nanoPro && nanoPro.sortOrder !== 11) {
    await db.update(aiModels).set({ sortOrder: 11, updatedAt: new Date() }).where(eq(aiModels.id, nanoPro.id));
  }

  let modelsCreated = 0;
  for (const seed of modelSeeds) {
    const { providerName, ...modelSeed } = seed;
    const exists = existingModels.find(m =>
      m.modelKey === seed.modelKey || (seed.modelKey === 'gemini-3-pro-image-preview' && m.modelKey === 'nano-banana-pro-preview')
    );
    const providerId = providerIds[providerName as keyof typeof providerIds];
    if (!exists) {
      await db.insert(aiModels).values({
        providerId,
        ...modelSeed,
      });
      modelsCreated++;
    } else {
      await db.update(aiModels).set({
        providerId,
        displayName: modelSeed.displayName,
        modelType: modelSeed.modelType,
        supportsStreaming: modelSeed.supportsStreaming,
        supportsImageInput: modelSeed.supportsImageInput,
        supportsDocumentInput: modelSeed.supportsDocumentInput,
        supportsImageOutput: modelSeed.supportsImageOutput,
        supportsSystemPrompt: modelSeed.supportsSystemPrompt,
        inputPricePer1k: modelSeed.inputPricePer1k,
        outputPricePer1k: modelSeed.outputPricePer1k,
        fixedPrice: modelSeed.fixedPrice,
        sortOrder: modelSeed.sortOrder,
        isActive: modelSeed.isActive,
        updatedAt: new Date(),
      }).where(eq(aiModels.id, exists.id));
    }
  }
  console.log(`Created ${modelsCreated} new models (${existingModels.length} already existed)`);

  // Seed platform settings
  const settingsSeeds = [
    { key: 'markup_percent', value: '50', description: 'Наценка в % от базовой стоимости AI-запросов' },
    { key: 'daily_free_requests', value: '10', description: 'Количество бесплатных AI-запросов в день' },
    { key: 'min_topup_amount', value: '100', description: 'Минимальная сумма пополнения (RUB)' },
    { key: 'max_topup_amount', value: '10000', description: 'Максимальная сумма пополнения (RUB)' },
    { key: 'free_for_admins', value: '1', description: 'Бесплатно для администраторов (1=да, 0=нет)' },
    { key: 'analytics_active_user_daily_requests', value: '5', description: 'Порог запросов за 24 часа для метрики активных пользователей' },
    { key: 'referral_signup_bonus_tokens', value: '500', description: 'Бонус по реферальной программе за регистрацию и подтверждение телефона' },
    { key: 'referral_course_purchase_bonus_tokens', value: '5000', description: 'Бонус пригласившему за покупку курса приглашённым пользователем' },
    { key: 'token_exchange_rate_rub_to_tokens', value: '10', description: 'Сколько токенов показывать за 1 RUB пользовательского баланса' },
    { key: 'course_14_price_rub', value: '10500', description: 'Цена курса на 14 дней' },
    { key: 'course_21_price_rub', value: '14500', description: 'Цена курса на 21 день' },
    { key: 'course_21_upgrade_price_rub', value: '4000', description: 'Цена апгрейда с 14 дней до 21 дня' },
    { key: 'phone_verification_required_for_referrals', value: '1', description: 'Требовать подтверждение телефона для реферальной программы' },
  ];

  for (const s of settingsSeeds) {
    await db.insert(platformSettings).values(s).onConflictDoNothing();
  }
  console.log('Platform settings seeded');
}

seedBilling()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
